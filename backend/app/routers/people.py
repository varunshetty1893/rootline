import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..rate_limit import enforce_user_limit

router = APIRouter(prefix="/people", tags=["people"])


def _get_owned_person(person_id: uuid.UUID, user: models.User, db: Session) -> models.Person:
    person = (
        db.query(models.Person)
        .filter(models.Person.id == person_id, models.Person.owner_id == user.id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


def _expanded_partner_ids(fu: models.FamilyUnit, db: Session) -> list[uuid.UUID]:
    """Return the visible parents for a family-child row.

    Older data can contain a child family with only one stored partner because
    the second parent was added as a separate spouse relationship. If that
    parent has exactly one spouse, include them in the serialized family so
    the tree can draw the complete couple without requiring destructive data
    cleanup.
    """
    partner_ids = [pid for pid in (fu.partner1_id, fu.partner2_id) if pid]
    if len(partner_ids) != 1:
        return partner_ids

    only_partner = partner_ids[0]
    spouse_units = (
        db.query(models.FamilyUnit)
        .filter(
            models.FamilyUnit.owner_id == fu.owner_id,
            or_(
                models.FamilyUnit.partner1_id == only_partner,
                models.FamilyUnit.partner2_id == only_partner,
            ),
        )
        .all()
    )
    spouse_ids = {
        other
        for spouse_unit in spouse_units
        for other in (
            spouse_unit.partner2_id
            if spouse_unit.partner1_id == only_partner
            else spouse_unit.partner1_id,
        )
        if other
    }
    if len(spouse_ids) == 1:
        partner_ids.append(next(iter(spouse_ids)))
    return partner_ids


def _family_option(
    fu: models.FamilyUnit,
    db: Session,
    child_id: uuid.UUID | None = None,
) -> schemas.FamilyOption:
    child_row = next((child for child in fu.children if child.person_id == child_id), None)
    partner_ids = _expanded_partner_ids(fu, db)
    return schemas.FamilyOption(
        id=fu.id,
        partner_ids=partner_ids,
        child_ids=[child.person_id for child in fu.children],
        relationship_type=child_row.relationship_type if child_row else None,
        relationship_status=fu.relationship_status,
    )


def _serialize_person(person: models.Person, db: Session) -> schemas.PersonOut:
    """Derives graph relationships and all family choices from Family Units."""
    child_rows = (
        db.query(models.FamilyChild)
        .filter(models.FamilyChild.person_id == person.id)
        .all()
    )
    parent_families: list[schemas.FamilyOption] = []
    parent_ids: list[uuid.UUID] = []
    for child_row in child_rows:
        fu = db.get(models.FamilyUnit, child_row.family_unit_id)
        if not fu:
            continue
        parent_families.append(_family_option(fu, db, person.id))
        parent_ids.extend(_expanded_partner_ids(fu, db))
    parent_ids = list(dict.fromkeys(parent_ids))

    spouse_ids: list[uuid.UUID] = []
    spouse_units = (
        db.query(models.FamilyUnit)
        .filter(
            or_(
                models.FamilyUnit.partner1_id == person.id,
                models.FamilyUnit.partner2_id == person.id,
            )
        )
        .all()
    )
    for fu in spouse_units:
        other = fu.partner2_id if fu.partner1_id == person.id else fu.partner1_id
        if other:
            spouse_ids.append(other)

    partner_families = [_family_option(fu, db) for fu in spouse_units]

    return schemas.PersonOut(
        id=person.id,
        name=person.name,
        gender=person.gender,
        date_of_birth=person.date_of_birth,
        date_of_death=person.date_of_death,
        place_of_birth=person.place_of_birth,
        occupation=person.occupation,
        bio=person.bio,
        created_at=person.created_at,
        parent_ids=parent_ids,
        spouse_ids=spouse_ids,
        parent_families=parent_families,
        partner_families=partner_families,
    )


def _apply_relation(
    new_person: models.Person,
    relation_type: schemas.RelationType | None,
    related_to_id: uuid.UUID | None,
    family_id: uuid.UUID | None,
    partner_id: uuid.UUID | None,
    family_relationship: str | None,
    partner_status: str | None,
    new_family: bool,
    owner_id: uuid.UUID,
    db: Session,
) -> None:
    """Wires a newly created person into the family graph via Family Units."""
    if relation_type is None or related_to_id is None:
        return

    related = (
        db.query(models.Person)
        .filter(models.Person.id == related_to_id, models.Person.owner_id == owner_id)
        .first()
    )
    if not related:
        raise HTTPException(status_code=400, detail="The person you're relating to wasn't found")

    selected_family = None
    if family_id:
        selected_family = (
            db.query(models.FamilyUnit)
            .filter(models.FamilyUnit.id == family_id, models.FamilyUnit.owner_id == owner_id)
            .first()
        )
        if not selected_family:
            raise HTTPException(status_code=400, detail="The selected family was not found")

    selected_partner = None
    if partner_id:
        selected_partner = (
            db.query(models.Person)
            .filter(models.Person.id == partner_id, models.Person.owner_id == owner_id)
            .first()
        )
        if not selected_partner:
            raise HTTPException(status_code=400, detail="The selected partner was not found")
        if selected_partner.id == related.id:
            raise HTTPException(status_code=400, detail="A person cannot be their own partner")

    if relation_type in (
        schemas.RelationType.father,
        schemas.RelationType.mother,
        schemas.RelationType.parent,
    ):
        # new_person becomes a parent of `related`.
        if selected_family:
            fu = selected_family
            related_child = next((child for child in fu.children if child.person_id == related.id), None)
            if not related_child:
                raise HTTPException(status_code=400, detail="That family does not belong to the selected person")
            if family_relationship and not related_child.relationship_type:
                related_child.relationship_type = family_relationship
        elif not new_family:
            child_rows = (
                db.query(models.FamilyChild)
                .filter(models.FamilyChild.person_id == related.id)
                .all()
            )
            if len(child_rows) > 1:
                raise HTTPException(
                    status_code=400,
                    detail="This person has multiple parent families. Choose the family explicitly.",
                )
            if child_rows:
                fu = db.get(models.FamilyUnit, child_rows[0].family_unit_id)
            else:
                fu = models.FamilyUnit(owner_id=owner_id)
                db.add(fu)
                db.flush()
                db.add(
                    models.FamilyChild(
                        family_unit_id=fu.id,
                        person_id=related.id,
                        relationship_type=family_relationship or "unknown",
                    )
                )
        else:
            fu = models.FamilyUnit(owner_id=owner_id)
            db.add(fu)
            db.flush()
            db.add(
                models.FamilyChild(
                    family_unit_id=fu.id,
                    person_id=related.id,
                    relationship_type=family_relationship or "unknown",
                )
            )

        if fu.partner1_id is None:
            fu.partner1_id = new_person.id
        elif fu.partner2_id is None:
            fu.partner2_id = new_person.id
        else:
            raise HTTPException(
                status_code=400, detail=f"{related.name} already has two parents recorded"
            )

    elif relation_type == schemas.RelationType.spouse:
        fu = models.FamilyUnit(
            owner_id=owner_id,
            partner1_id=related.id,
            partner2_id=new_person.id,
            relationship_status=partner_status or "partner",
        )
        db.add(fu)

    elif relation_type == schemas.RelationType.child:
        # new_person becomes a child of the explicitly selected family. The
        # client chooses this after asking "same or different partner".
        fu = selected_family
        if fu and related.id not in (fu.partner1_id, fu.partner2_id):
            raise HTTPException(status_code=400, detail="That family does not belong to the selected person")
        if not fu and selected_partner:
            fu = models.FamilyUnit(
                owner_id=owner_id,
                partner1_id=related.id,
                partner2_id=selected_partner.id,
                relationship_status=partner_status or "partner",
            )
            db.add(fu)
            db.flush()
        if not fu:
            # Preserve the person's existing partner family when the caller
            # does not explicitly choose one. This is the normal API path for
            # imports and seed scripts; otherwise children are incorrectly
            # stored in a second one-parent family and the UI draws duplicate
            # parent-child connectors.
            partner_families = (
                db.query(models.FamilyUnit)
                .filter(
                    models.FamilyUnit.owner_id == owner_id,
                    or_(
                        models.FamilyUnit.partner1_id == related.id,
                        models.FamilyUnit.partner2_id == related.id,
                    ),
                )
                .order_by(models.FamilyUnit.created_at)
                .all()
            )
            complete_partner_families = [
                family for family in partner_families if family.partner1_id and family.partner2_id
            ]
            # Only infer the family when there is exactly one possible
            # partner. Multiple partnerships must be chosen explicitly by the
            # caller so a new child cannot silently land in the wrong branch.
            fu = complete_partner_families[0] if len(complete_partner_families) == 1 else None
            if not fu:
                fu = models.FamilyUnit(
                    owner_id=owner_id,
                    partner1_id=related.id,
                    relationship_status=partner_status or "partner",
                )
                db.add(fu)
                db.flush()
        db.add(
            models.FamilyChild(
                family_unit_id=fu.id,
                person_id=new_person.id,
                relationship_type=family_relationship or "unknown",
            )
        )

    elif relation_type == schemas.RelationType.sibling:
        # new_person becomes another child in `related`'s parent family unit
        # selected explicitly when the person has more than one family.
        if selected_family:
            fu = selected_family
            if not any(child.person_id == related.id for child in fu.children):
                raise HTTPException(status_code=400, detail="That family does not belong to the selected person")
        elif not new_family:
            child_row = (
                db.query(models.FamilyChild)
                .filter(models.FamilyChild.person_id == related.id)
                .first()
            )
            if child_row:
                fu = db.get(models.FamilyUnit, child_row.family_unit_id)
            else:
                fu = models.FamilyUnit(owner_id=owner_id)
                db.add(fu)
                db.flush()
                db.add(
                    models.FamilyChild(
                        family_unit_id=fu.id,
                        person_id=related.id,
                        relationship_type=family_relationship or "unknown",
                    )
                )
        if not selected_family and new_family:
            fu = models.FamilyUnit(owner_id=owner_id)
            db.add(fu)
            db.flush()
            db.add(
                models.FamilyChild(
                    family_unit_id=fu.id,
                    person_id=related.id,
                    relationship_type=family_relationship or "unknown",
                )
            )
        db.add(
            models.FamilyChild(
                family_unit_id=fu.id,
                person_id=new_person.id,
                relationship_type=family_relationship or "unknown",
            )
        )


@router.post("/link", response_model=schemas.MessageResponse)
def link_existing_people(
    payload: schemas.ExistingRelationshipCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Connect two existing people without creating a duplicate person.

    A one-sided family unit is upgraded in place when possible. This matters
    for a common workflow where children were added to one parent first and
    the other parent is linked later: the existing children stay attached to
    the same family unit instead of receiving a second, duplicate connector.
    """
    enforce_user_limit(request, str(current_user.id), write=True)
    if payload.first_person_id == payload.second_person_id:
        raise HTTPException(status_code=400, detail="A person cannot be linked to themself")
    if payload.relationship_type != schemas.RelationType.spouse:
        raise HTTPException(
            status_code=400,
            detail="Only spouse / partner links between existing people are supported",
        )

    people = (
        db.query(models.Person)
        .filter(
            models.Person.owner_id == current_user.id,
            models.Person.id.in_([payload.first_person_id, payload.second_person_id]),
        )
        .all()
    )
    people_by_id = {person.id: person for person in people}
    if len(people_by_id) != 2:
        raise HTTPException(status_code=404, detail="One of the people was not found")

    first_id = payload.first_person_id
    second_id = payload.second_person_id
    existing = (
        db.query(models.FamilyUnit)
        .filter(
            models.FamilyUnit.owner_id == current_user.id,
            or_(
                (
                    models.FamilyUnit.partner1_id == first_id
                )
                & (models.FamilyUnit.partner2_id == second_id),
                (
                    models.FamilyUnit.partner1_id == second_id
                )
                & (models.FamilyUnit.partner2_id == first_id),
            ),
        )
        .first()
    )
    if existing:
        if payload.relationship_status:
            existing.relationship_status = payload.relationship_status
        db.commit()
        return schemas.MessageResponse(message="People are already linked.")

    # Prefer a one-parent family unit that already has children. Upgrading it
    # preserves the child rows and prevents duplicate parent-child edges.
    candidate_units = (
        db.query(models.FamilyUnit)
        .filter(
            models.FamilyUnit.owner_id == current_user.id,
            or_(
                models.FamilyUnit.partner1_id.in_([first_id, second_id]),
                models.FamilyUnit.partner2_id.in_([first_id, second_id]),
            ),
        )
        .all()
    )
    candidate_units.sort(
        key=lambda family: (
            -len(family.children),
            0 if family.partner2_id is None or family.partner1_id is None else 1,
            str(family.created_at),
        )
    )
    for family in candidate_units:
        if family.partner1_id == first_id and family.partner2_id is None:
            family.partner2_id = second_id
            family.relationship_status = payload.relationship_status or family.relationship_status or "partner"
            db.commit()
            return schemas.MessageResponse(message="People linked.")
        if family.partner1_id == second_id and family.partner2_id is None:
            family.partner2_id = first_id
            family.relationship_status = payload.relationship_status or family.relationship_status or "partner"
            db.commit()
            return schemas.MessageResponse(message="People linked.")
        if family.partner2_id == first_id and family.partner1_id is None:
            family.partner1_id = second_id
            family.relationship_status = payload.relationship_status or family.relationship_status or "partner"
            db.commit()
            return schemas.MessageResponse(message="People linked.")
        if family.partner2_id == second_id and family.partner1_id is None:
            family.partner1_id = first_id
            family.relationship_status = payload.relationship_status or family.relationship_status or "partner"
            db.commit()
            return schemas.MessageResponse(message="People linked.")

    db.add(
        models.FamilyUnit(
            owner_id=current_user.id,
            partner1_id=first_id,
            partner2_id=second_id,
            relationship_status=payload.relationship_status or "partner",
        )
    )
    db.commit()
    return schemas.MessageResponse(message="People linked.")


@router.get("", response_model=list[schemas.PersonOut])
def list_people(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    enforce_user_limit(request, str(current_user.id))
    people = (
        db.query(models.Person)
        .filter(models.Person.owner_id == current_user.id)
        .order_by(models.Person.created_at)
        .all()
    )
    return [_serialize_person(p, db) for p in people]


@router.post("", response_model=schemas.PersonOut, status_code=status.HTTP_201_CREATED)
def create_person(
    payload: schemas.PersonCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    enforce_user_limit(request, str(current_user.id), write=True)
    data = payload.model_dump(
        exclude={
            "relation_type",
            "related_to_id",
            "family_id",
            "partner_id",
            "family_relationship",
            "partner_status",
            "new_family",
        }
    )
    person = models.Person(owner_id=current_user.id, **data)
    db.add(person)
    db.flush()  # person.id is available now, without committing yet

    _apply_relation(
        person,
        payload.relation_type,
        payload.related_to_id,
        payload.family_id,
        payload.partner_id,
        payload.family_relationship,
        payload.partner_status,
        payload.new_family,
        current_user.id,
        db,
    )

    db.commit()
    db.refresh(person)
    return _serialize_person(person, db)


@router.get("/{person_id}", response_model=schemas.PersonOut)
def get_person(
    person_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    enforce_user_limit(request, str(current_user.id))
    person = _get_owned_person(person_id, current_user, db)
    return _serialize_person(person, db)


@router.patch("/{person_id}", response_model=schemas.PersonOut)
def update_person(
    person_id: uuid.UUID,
    payload: schemas.PersonUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    enforce_user_limit(request, str(current_user.id), write=True)
    person = _get_owned_person(person_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    db.commit()
    db.refresh(person)
    return _serialize_person(person, db)


@router.delete("/{person_id}", response_model=schemas.MessageResponse)
def delete_person(
    person_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    enforce_user_limit(request, str(current_user.id), write=True)
    person = _get_owned_person(person_id, current_user, db)

    # Clean up any Family Unit rows that reference this person, so deleting
    # someone doesn't leave dangling parent/spouse/child references behind.
    db.query(models.FamilyChild).filter(models.FamilyChild.person_id == person_id).delete()
    for fu in (
        db.query(models.FamilyUnit)
        .filter(
            or_(
                models.FamilyUnit.partner1_id == person_id,
                models.FamilyUnit.partner2_id == person_id,
            )
        )
        .all()
    ):
        if fu.partner1_id == person_id:
            fu.partner1_id = None
        if fu.partner2_id == person_id:
            fu.partner2_id = None

    db.delete(person)
    db.commit()
    return schemas.MessageResponse(message="Person removed.")
