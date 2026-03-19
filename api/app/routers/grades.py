from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.security import ALGORITHM, SECRET_KEY
from app.database import get_db
from app.models import Employee, Grade, User
from app.schemas import EmployeeMonthlyGradeCount, GradeCreate, GradeResponse

router = APIRouter(prefix="/grades", tags=["Grades"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def _current_month_bounds() -> tuple[datetime, datetime]:
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    if now.month == 12:
        next_month_start = datetime(now.year + 1, 1, 1)
    else:
        next_month_start = datetime(now.year, now.month + 1, 1)
    return month_start, next_month_start


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/", response_model=GradeResponse)
def create_grade(
    grade_data: GradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    employee = db.query(Employee).filter(Employee.id == grade_data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if current_user.role == "MANAGER" and employee.branch_id != current_user.branch_id:
        raise HTTPException(
            status_code=403, detail="Cannot grade employee from another branch"
        )

    # Проверка: не больше 3 оценок за месяц
    month_start, next_month_start = _current_month_bounds()
    grades_count = db.query(Grade).filter(
        Grade.employee_id == grade_data.employee_id,
        Grade.created_at >= month_start,
        Grade.created_at < next_month_start
    ).count()
    if grades_count >= 3:
        raise HTTPException(status_code=400, detail="Нельзя поставить больше трех оценок за месяц")

    grade = Grade(
        value=grade_data.value,
        role_in_shift=grade_data.role_in_shift,
        comment=grade_data.comment,
        employee_id=grade_data.employee_id,
        manager_id=current_user.id,
        status="APPROVED" if current_user.role == "ADMIN" else "PENDING",
    )
    db.add(grade)
    db.commit()
    db.refresh(grade)

    # Добавляем имена менеджера и сотрудника в ответ
    grade.manager_name = current_user.username
    grade.employee_name = employee.name

    return grade


@router.get("/employee/{employee_id}", response_model=List[GradeResponse])
def get_grades_for_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # MANAGER видит только своих сотрудников
    if current_user.role == "MANAGER" and employee.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    month_start, next_month_start = _current_month_bounds()
    return db.query(Grade).filter(
        Grade.employee_id == employee_id,
        Grade.created_at >= month_start,
        Grade.created_at < next_month_start
    ).all()


@router.get("/monthly-counts", response_model=List[EmployeeMonthlyGradeCount])
def get_monthly_grade_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    month_start, next_month_start = _current_month_bounds()

    query = db.query(
        Employee.id.label("employee_id"),
        func.count(Grade.id).label("grades_count"),
    ).outerjoin(
        Grade,
        and_(
            Employee.id == Grade.employee_id,
            Grade.created_at >= month_start,
            Grade.created_at < next_month_start,
        ),
    )

    if current_user.role == "MANAGER":
        query = query.filter(Employee.branch_id == current_user.branch_id)

    return query.group_by(Employee.id).all()


@router.get("/pending", response_model=List[GradeResponse])
def get_pending_grades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all pending grades. ADMIN sees all, MANAGER sees only own."""
    query = db.query(Grade).filter(Grade.status == "PENDING")
    if current_user.role == "MANAGER":
        query = query.filter(Grade.manager_id == current_user.id)
    return query.order_by(Grade.created_at.desc()).all()


@router.patch("/{grade_id}/approve", response_model=GradeResponse)
def approve_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403, detail="Только админ может подтверждать оценки"
        )
    grade = db.query(Grade).filter(Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Оценка не найдена")
    if grade.status != "PENDING":
        raise HTTPException(status_code=400, detail="Оценка уже обработана")
    grade.status = "APPROVED"
    db.commit()
    db.refresh(grade)
    return grade


@router.patch("/{grade_id}/reject", response_model=GradeResponse)
def reject_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403, detail="Только админ может отклонять оценки"
        )
    grade = db.query(Grade).filter(Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Оценка не найдена")
    if grade.status != "PENDING":
        raise HTTPException(status_code=400, detail="Оценка уже обработана")
    grade.status = "REJECTED"
    db.commit()
    db.refresh(grade)
    return grade