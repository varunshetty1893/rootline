import uuid
from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class StrictSchema(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class UserCreate(StrictSchema):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()


class UserOut(StrictSchema):
    id: uuid.UUID
    name: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class LoginRequest(StrictSchema):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()


class Token(StrictSchema):
    access_token: str = Field(min_length=1, max_length=4096)
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(StrictSchema):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()


class ResetPasswordRequest(StrictSchema):
    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(StrictSchema):
    message: str = Field(min_length=1, max_length=300)


# ── People ───────────────────────────────────────────────────────────────
class RelationType(str, Enum):
    father = "father"
    mother = "mother"
    parent = "parent"
    spouse = "spouse"
    child = "child"
    sibling = "sibling"


class PersonBase(StrictSchema):
    name: str = Field(min_length=1, max_length=120)
    gender: Literal["male", "female", "other", "unspecified"] | None = None
    date_of_birth: date | None = None
    date_of_death: date | None = None
    place_of_birth: str | None = Field(default=None, max_length=160)
    occupation: str | None = Field(default=None, max_length=160)
    bio: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def valid_life_dates(self):
        if self.date_of_birth and self.date_of_death and self.date_of_death < self.date_of_birth:
            raise ValueError("Date of death cannot be before date of birth")
        return self


class PersonCreate(PersonBase):
    # Optional: connect this new person to someone already in the tree,
    # e.g. relation_type="father", related_to_id=<Varun's id> means
    # "this new person is Varun's father".
    relation_type: RelationType | None = None
    related_to_id: uuid.UUID | None = None
    # Optional family unit chosen by the relationship-aware add flow. This is
    # important for people with multiple parent families or partners.
    family_id: uuid.UUID | None = None
    # Used when a child is being added with an existing person who is not yet
    # linked as the selected person's partner.
    partner_id: uuid.UUID | None = None
    family_relationship: Literal["biological", "adoptive", "step", "unknown"] | None = None
    partner_status: Literal["partner", "married", "separated", "divorced", "unknown"] | None = None
    new_family: bool = False


class PersonUpdate(StrictSchema):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    gender: Literal["male", "female", "other", "unspecified"] | None = None
    date_of_birth: date | None = None
    date_of_death: date | None = None
    place_of_birth: str | None = Field(default=None, max_length=160)
    occupation: str | None = Field(default=None, max_length=160)
    bio: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def valid_life_dates(self):
        if self.date_of_birth and self.date_of_death and self.date_of_death < self.date_of_birth:
            raise ValueError("Date of death cannot be before date of birth")
        return self


class ExistingRelationshipCreate(StrictSchema):
    """Connect two people who already exist in the current family tree."""

    first_person_id: uuid.UUID
    second_person_id: uuid.UUID
    relationship_type: RelationType = RelationType.spouse
    relationship_status: Literal["partner", "married", "separated", "divorced", "unknown"] | None = None

    @model_validator(mode="after")
    def distinct_people(self):
        if self.first_person_id == self.second_person_id:
            raise ValueError("The two people must be different")
        return self


class FamilyOption(StrictSchema):
    id: uuid.UUID
    partner_ids: list[uuid.UUID] = Field(default_factory=list, max_length=2)
    child_ids: list[uuid.UUID] = Field(default_factory=list, max_length=10000)
    relationship_type: Literal["biological", "adoptive", "step", "unknown"] | None = None
    relationship_status: Literal["partner", "married", "separated", "divorced", "unknown"] | None = None


class PersonOut(PersonBase):
    id: uuid.UUID
    created_at: datetime
    parent_ids: list[uuid.UUID] = Field(default_factory=list, max_length=2)
    spouse_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)
    # All family units are returned so the UI can ask instead of guessing.
    parent_families: list[FamilyOption] = Field(default_factory=list, max_length=1000)
    partner_families: list[FamilyOption] = Field(default_factory=list, max_length=1000)

    model_config = ConfigDict(from_attributes=True, extra="forbid")
