from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.security import ALGORITHM, SECRET_KEY
from app.database import get_db
from app.models import Employee, Grade, User
from app.schemas import EmployeeRating

router = APIRouter(prefix="/ratings", tags=["Ratings"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def _parse_month_bounds(month: str | None) -> tuple[datetime, datetime] | None:
    if not month:
        return None

    try:
        month_start = datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")

    if month_start.month == 12:
        next_month_start = datetime(month_start.year + 1, 1, 1)
    else:
        next_month_start = datetime(month_start.year, month_start.month + 1, 1)

    return month_start, next_month_start


def _resolve_date_bounds(
    period: str | None,
    date_from: str | None,
    date_to: str | None,
    month: str | None,
) -> tuple[datetime, datetime] | None:
    if date_from or date_to:
        if not date_from or not date_to:
            raise HTTPException(
                status_code=400,
                detail="date_from and date_to must be provided together",
            )

        try:
            date_from_start = datetime.strptime(date_from, "%Y-%m-%d")
            date_to_start = datetime.strptime(date_to, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="date_from/date_to must be in YYYY-MM-DD format",
            )

        date_to_end = date_to_start + timedelta(days=1)
        if date_to_end <= date_from_start:
            raise HTTPException(
                status_code=400,
                detail="date_to must be greater than or equal to date_from",
            )

        return date_from_start, date_to_end

    if month and not period:
        return _parse_month_bounds(month)

    normalized_period = (period or "all").strip().lower()
    if normalized_period in {"", "all"}:
        return None

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    if normalized_period == "yesterday":
        start = today_start - timedelta(days=1)
        end = today_start
        return start, end

    if normalized_period == "week":
        week_start = today_start - timedelta(days=today_start.weekday())
        return week_start, now + timedelta(seconds=1)

    if normalized_period == "month":
        month_start = datetime(now.year, now.month, 1)
        return month_start, now + timedelta(seconds=1)

    if normalized_period == "year":
        year_start = datetime(now.year, 1, 1)
        return year_start, now + timedelta(seconds=1)

    raise HTTPException(
        status_code=400,
        detail="period must be one of: all, yesterday, week, month, year",
    )


def _approved_grade_join_condition(
    period: str | None,
    date_from: str | None,
    date_to: str | None,
    month: str | None,
):
    conditions = [Employee.id == Grade.employee_id, Grade.status == "APPROVED"]
    bounds = _resolve_date_bounds(period, date_from, date_to, month)
    if bounds is not None:
        date_start, date_end = bounds
        conditions.extend(
            [
                Grade.created_at >= date_start,
                Grade.created_at < date_end,
            ]
        )
    return and_(*conditions)


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


@router.get("/branch/{branch_id}", response_model=List[EmployeeRating])
def get_branch_ratings(
    branch_id: int,
    period: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    avg_score = func.coalesce(func.avg(Grade.value), 0.0)

    # MANAGER может смотреть только свой филиал
    if current_user.role == "MANAGER" and branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # По умолчанию рейтинг за текущий месяц
    if not any([period, date_from, date_to, month]):
        now = datetime.utcnow()
        month = f"{now.year}-{now.month:02d}"

    ratings = (
        db.query(
            Employee.id.label("employee_id"),
            Employee.name.label("employee_name"),
            avg_score.label("average_score"),
            func.count(Grade.id).label("total_grades"),
        )
        .outerjoin(
            Grade, _approved_grade_join_condition(period, date_from, date_to, month)
        )
        .filter(Employee.branch_id == branch_id)
        .group_by(Employee.id)
        .order_by(avg_score.desc())
        .all()
    )
    return ratings


@router.get("/all", response_model=List[EmployeeRating])
def get_all_ratings(
    period: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    avg_score = func.coalesce(func.avg(Grade.value), 0.0)

    # По умолчанию рейтинг за текущий месяц
    if not any([period, date_from, date_to, month]):
        now = datetime.utcnow()
        month = f"{now.year}-{now.month:02d}"

    query = db.query(
        Employee.id.label("employee_id"),
        Employee.name.label("employee_name"),
        avg_score.label("average_score"),
        func.count(Grade.id).label("total_grades"),
    ).outerjoin(
        Grade, _approved_grade_join_condition(period, date_from, date_to, month)
    )

    # MANAGER теперь видит всех сотрудников (фильтр убран)

    ratings = query.group_by(Employee.id).order_by(avg_score.desc()).all()
    return ratings


@router.get("/top", response_model=List[EmployeeRating])
def get_top_employees(
    top_n: int = 10,
    period: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Возвращает топ N сотрудников по среднему баллу.
    - ADMIN видит всех
    - MANAGER видит только свой филиал
    """
    avg_score = func.coalesce(func.avg(Grade.value), 0.0)

    # По умолчанию рейтинг за текущий месяц
    if not any([period, date_from, date_to, month]):
        now = datetime.utcnow()
        month = f"{now.year}-{now.month:02d}"

    query = db.query(
        Employee.id.label("employee_id"),
        Employee.name.label("employee_name"),
        avg_score.label("average_score"),
        func.count(Grade.id).label("total_grades"),
    ).outerjoin(
        Grade, _approved_grade_join_condition(period, date_from, date_to, month)
    )

    # MANAGER видит только свой филиал
    if current_user.role == "MANAGER":
        query = query.filter(Employee.branch_id == current_user.branch_id)

    query = query.group_by(Employee.id).order_by(avg_score.desc()).limit(top_n)
    return query.all()