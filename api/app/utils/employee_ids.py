from sqlalchemy.orm import Session

from app.models import Employee


def next_employee_id_for_branch(db: Session, branch_id: int) -> int:
    """Generate employee id in xxyy format: xx=branch id, yy=employee number in branch."""
    if branch_id < 1 or branch_id > 99:
        raise ValueError("Branch id must be in range 1..99 for xxyy employee id format")

    employees = db.query(Employee.id).filter(Employee.branch_id == branch_id).all()

    used_suffixes = {
        employee_id % 100
        for (employee_id,) in employees
        if employee_id // 100 == branch_id and 1 <= employee_id % 100 <= 99
    }

    for suffix in range(1, 100):
        if suffix not in used_suffixes:
            return branch_id * 100 + suffix

    raise ValueError(
        "No available employee ids left for this branch (yy range is 01..99)"
    )