from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class EmployeeRating(BaseModel):
    employee_id: int
    employee_name: str
    average_score: float
    total_grades: int

    class Config:
        from_attributes = True


class GradeCreate(BaseModel):
    value: int  # 1–100
    role_in_shift: str  # Продавец, Официант, Кассир, Бариста
    comment: Optional[str] = None
    employee_id: int

    @field_validator("role_in_shift")
    @classmethod
    def validate_role_in_shift(cls, value: str) -> str:
        role_map = {
            "кассир": "Кассир",
            "продавец": "Продавец",
            "официант": "Официант",
            "бариста": "Бариста",
        }
        normalized = value.strip().lower()
        if normalized not in role_map:
            raise ValueError(
                "Role in shift must be one of: Кассир, Продавец, Официант, Бариста"
            )
        return role_map[normalized]


class GradeResponse(BaseModel):
    id: int
    value: int
    role_in_shift: str
    comment: Optional[str]
    employee_id: int
    manager_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EmployeeMonthlyGradeCount(BaseModel):
    employee_id: int
    grades_count: int


class EmployeeCreate(BaseModel):
    name: str
    branch_id: int
    hired_at: Optional[date] = None


class EmployeeResponse(BaseModel):
    id: int
    name: str
    branch_id: int
    hired_at: Optional[date] = None

    class Config:
        from_attributes = True


class BranchCreate(BaseModel):
    name: str
    city: str = "Almaty"

    @field_validator("name")
    @classmethod
    def validate_branch_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Branch name cannot be empty")
        return normalized


class BranchResponse(BaseModel):
    id: int
    name: str
    city: str

    class Config:
        from_attributes = True


class BranchWithRating(BaseModel):
    id: int
    name: str
    city: str
    average_score: float
    employee_count: int

    class Config:
        from_attributes = True


class BranchUpdate(BaseModel):
    name: str
    city: str = "Almaty"

    @field_validator("name")
    @classmethod
    def validate_branch_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Branch name cannot be empty")
        return normalized


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    role: str  # ADMIN или MANAGER
    branch_id: int

    @field_validator("role")
    @classmethod
    def validate_and_normalize_role(cls, value: str) -> str:
        normalized = value.strip().upper()
        allowed_roles = {"ADMIN", "MANAGER"}
        if normalized not in allowed_roles:
            raise ValueError("Role must be ADMIN or MANAGER")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long for bcrypt (max 72 bytes)")
        return value


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    branch_id: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"