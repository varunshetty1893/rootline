"""Repair the original Rootline seed account without deleting its data.

This fixes seed data created before existing-person linking was supported:
* Babu's DOB is set to 31 October 1968.
* Babu is attached to Seena and Lakshmi as the youngest child.
* Babu and Shubha are linked as partners, preserving Babu's children.

Run from the backend directory:
    python scripts/repair_seed_family.py
"""

from datetime import date
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models
from app.database import SessionLocal


def one_person(db, owner_id, name, bio_contains=None):
    query = db.query(models.Person).filter(
        models.Person.owner_id == owner_id,
        models.Person.name == name,
    )
    if bio_contains:
        query = query.filter(models.Person.bio.ilike(f"%{bio_contains}%"))
    return query.order_by(models.Person.created_at).first()


def link_partners(db, owner_id, first_id, second_id):
    units = (
        db.query(models.FamilyUnit)
        .filter(
            models.FamilyUnit.owner_id == owner_id,
            models.FamilyUnit.partner1_id.in_([first_id, second_id])
            | models.FamilyUnit.partner2_id.in_([first_id, second_id]),
        )
        .all()
    )
    for family in units:
        if {family.partner1_id, family.partner2_id} == {first_id, second_id}:
            return family

    units.sort(key=lambda family: (-len(family.children), str(family.created_at)))
    for family in units:
        if family.partner1_id == first_id and family.partner2_id is None:
            family.partner2_id = second_id
            family.relationship_status = family.relationship_status or "married"
            return family
        if family.partner1_id == second_id and family.partner2_id is None:
            family.partner2_id = first_id
            family.relationship_status = family.relationship_status or "married"
            return family
        if family.partner2_id == first_id and family.partner1_id is None:
            family.partner1_id = second_id
            family.relationship_status = family.relationship_status or "married"
            return family
        if family.partner2_id == second_id and family.partner1_id is None:
            family.partner1_id = first_id
            family.relationship_status = family.relationship_status or "married"
            return family

    family = models.FamilyUnit(
        owner_id=owner_id,
        partner1_id=first_id,
        partner2_id=second_id,
        relationship_status="married",
    )
    db.add(family)
    db.flush()
    return family


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default="rootline.seed@example.com")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == args.email).first()
        if not user:
            raise SystemExit(f"No user found for {args.email}")

        babu = one_person(db, user.id, "Babu", "Varun's father")
        seena = one_person(db, user.id, "Seena")
        lakshmi = one_person(db, user.id, "Lakshmi")
        shubha = one_person(db, user.id, "Shubha")
        if not all((babu, seena, lakshmi, shubha)):
            raise SystemExit("Could not find Babu, Seena, Lakshmi, and Shubha in the seed account")

        babu.date_of_birth = date(1968, 10, 31)

        parent_row = (
            db.query(models.FamilyChild)
            .filter(models.FamilyChild.person_id == babu.id)
            .first()
        )
        parent_family = db.get(models.FamilyUnit, parent_row.family_unit_id) if parent_row else None
        if not parent_family:
            parent_family = models.FamilyUnit(owner_id=user.id, partner1_id=seena.id, partner2_id=lakshmi.id)
            db.add(parent_family)
            db.flush()
            db.add(models.FamilyChild(family_unit_id=parent_family.id, person_id=babu.id, relationship_type="biological"))
        else:
            parent_ids = {parent_family.partner1_id, parent_family.partner2_id}
            if seena.id in parent_ids and lakshmi.id not in parent_ids:
                if parent_family.partner1_id is None:
                    parent_family.partner1_id = lakshmi.id
                elif parent_family.partner2_id is None:
                    parent_family.partner2_id = lakshmi.id

        link_partners(db, user.id, babu.id, shubha.id)
        db.commit()
        print("Repaired Babu's DOB, both parents, and Shubha partner link.")
    finally:
        db.close()


if __name__ == "__main__":
    main()