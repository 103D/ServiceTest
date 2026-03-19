from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from sqlalchemy.orm import Session

from app.core.security import ALGORITHM, SECRET_KEY
from app.database import get_db
from app.models import Branch, Employee, User
from app.schemas import EmployeeCreate, EmployeeResponse
from app.utils.employee_ids import next_employee_id_for_branch

router = APIRouter(prefix="/employees", tags=["Employees"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# Вспомогательная функция для получения пользователя из токена
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/", response_model=EmployeeResponse)
def create_employee(
    employee_data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Только MANAGER и ADMIN могут создавать сотрудников
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    # MANAGER — принудительно используем его филиал
    if current_user.role == "MANAGER":
        employee_data.branch_id = current_user.branch_id

    branch = db.query(Branch).filter(Branch.id == employee_data.branch_id).first()
    if not branch:
        raise HTTPException(status_code=400, detail="Branch not found")

    try:
        employee_id = next_employee_id_for_branch(db, employee_data.branch_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    employee = Employee(
        id=employee_id,
        name=employee_data.name,
        branch_id=employee_data.branch_id,
        hired_at=employee_data.hired_at,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.get("/", response_model=List[EmployeeResponse])
def get_employees(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if current_user.role == "ADMIN":
        return db.query(Employee).all()
    else:  # MANAGER видит только сотрудников своего филиала
        return (
            db.query(Employee)
            .filter(Employee.branch_id == current_user.branch_id)
            .all()
        )


@router.delete("/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if current_user.role == "MANAGER" and employee.branch_id != current_user.branch_id:
        raise HTTPException(
            status_code=403, detail="Нельзя удалить сотрудника из другого филиала"
        )

    db.delete(employee)
    db.commit()