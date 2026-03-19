import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# from sqlalchemy import inspect, text
# from sqlalchemy.orm import Session
# from app import models
# from app.database import engine
from app.routers import auth, branches, employees, grades, ratings
# from app.utils.employee_ids import next_employee_id_for_branch

app = FastAPI(
    title="CheckList Service APIs",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc"
)
# CORS origins are configured from env for production safety.
# Example: CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
origins_env = os.getenv("CORS_ORIGINS", "")
if origins_env.strip():
    origins = [item.strip() for item in origins_env.split(",") if item.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Можно указать список фронтендов
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# @app.on_event("startup")
# def on_startup():
#     print("CREATING TABLES...")
#     models.Base.metadata.create_all(bind=engine)
#     ensure_grade_created_at_column()
#     ensure_grade_role_in_shift_column()
    # ensure_grade_status_column()
    # ensure_employee_hired_at_column()
    # ensure_branch_city_column()
    # migrate_employee_ids_to_xxyy()
    # reset_sequences()
    # print("DONE")


def ensure_grade_created_at_column() -> None:
    inspector = inspect(engine)
    if "grades" not in inspector.get_table_names():
        return

    grade_columns = {column["name"] for column in inspector.get_columns("grades")}
    if "created_at" in grade_columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE grades "
                "ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
            )
        )


def ensure_grade_role_in_shift_column() -> None:
    inspector = inspect(engine)
    if "grades" not in inspector.get_table_names():
        return

    grade_columns = {column["name"] for column in inspector.get_columns("grades")}

    with engine.begin() as connection:
        if "role_in_shift" not in grade_columns:
            connection.execute(
                text(
                    "ALTER TABLE grades "
                    "ADD COLUMN role_in_shift VARCHAR NOT NULL DEFAULT 'Продавец'"
                )
            )

        connection.execute(
            text(
                "UPDATE grades "
                "SET role_in_shift = 'Продавец' "
                "WHERE role_in_shift IS NULL OR TRIM(role_in_shift) = ''"
            )
        )


def ensure_grade_status_column() -> None:
    inspector = inspect(engine)
    if "grades" not in inspector.get_table_names():
        return

    grade_columns = {column["name"] for column in inspector.get_columns("grades")}

    with engine.begin() as connection:
        if "status" not in grade_columns:
            connection.execute(
                text(
                    "ALTER TABLE grades "
                    "ADD COLUMN status VARCHAR NOT NULL DEFAULT 'APPROVED'"
                )
            )


def ensure_employee_hired_at_column() -> None:
    inspector = inspect(engine)
    if "employees" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("employees")}

    if "hired_at" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE employees ADD COLUMN hired_at DATE"))


def ensure_branch_city_column() -> None:
    inspector = inspect(engine)
    if "branches" not in inspector.get_table_names():
        return

    branch_columns = {column["name"] for column in inspector.get_columns("branches")}

    with engine.begin() as connection:
        if "city" not in branch_columns:
            connection.execute(
                text(
                    "ALTER TABLE branches "
                    "ADD COLUMN city VARCHAR NOT NULL DEFAULT 'Almaty'"
                )
            )

        connection.execute(
            text(
                "UPDATE branches "
                "SET city = 'Almaty' "
                "WHERE city IS NULL OR TRIM(city) = ''"
            )
        )


def migrate_employee_ids_to_xxyy() -> None:
    """Backfill legacy employee ids to xxyy and keep grades references consistent."""
    with Session(engine) as db:
        employees_by_branch = {}
        for employee in (
            db.query(models.Employee)
            .order_by(models.Employee.branch_id, models.Employee.id)
            .all()
        ):
            employees_by_branch.setdefault(employee.branch_id, []).append(employee)

        mapping: dict[int, int] = {}
        for branch_id, branch_employees in employees_by_branch.items():
            if branch_id < 1 or branch_id > 99:
                continue

            if len(branch_employees) > 99:
                continue

            for index, employee in enumerate(branch_employees, start=1):
                new_id = branch_id * 100 + index
                if employee.id != new_id:
                    mapping[employee.id] = new_id

        if not mapping:
            return

        temp_ids = {}
        for old_id in mapping:
            temp_id = 1_000_000 + old_id
            while (
                db.query(models.Employee).filter(models.Employee.id == temp_id).first()
                is not None
            ):
                temp_id += 1_000_000
            temp_ids[old_id] = temp_id

        # Stage 1: move rows to temporary ids and repoint grades.
        for old_id, temp_id in temp_ids.items():
            old_employee = (
                db.query(models.Employee).filter(models.Employee.id == old_id).first()
            )
            if not old_employee:
                continue

            db.add(
                models.Employee(
                    id=temp_id,
                    name=old_employee.name,
                    branch_id=old_employee.branch_id,
                    hired_at=old_employee.hired_at,
                )
            )
            db.query(models.Grade).filter(models.Grade.employee_id == old_id).update(
                {models.Grade.employee_id: temp_id}
            )
            db.delete(old_employee)

        db.flush()

        # Stage 2: move rows from temporary ids to final xxyy ids and repoint grades.
        for old_id, new_id in mapping.items():
            temp_id = temp_ids[old_id]
            temp_employee = (
                db.query(models.Employee).filter(models.Employee.id == temp_id).first()
            )
            if not temp_employee:
                continue

            db.add(
                models.Employee(
                    id=new_id,
                    name=temp_employee.name,
                    branch_id=temp_employee.branch_id,
                    hired_at=temp_employee.hired_at,
                )
            )
            db.query(models.Grade).filter(models.Grade.employee_id == temp_id).update(
                {models.Grade.employee_id: new_id}
            )
            db.delete(temp_employee)

        db.commit()


def reset_sequences() -> None:
    tables = ["employees", "grades", "branches", "users"]
    with engine.begin() as connection:
        for table in tables:
            seq_name = f"{table}_id_seq"
            result = connection.execute(
                text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")
            ).scalar()
            connection.execute(
                text(f"ALTER SEQUENCE {seq_name} RESTART WITH {result + 1}")
            )


def seed_demo_employees_and_grades() -> None:
    with Session(engine) as db:
        grade_count = db.query(models.Grade).count()
        if grade_count >= 30:
            return

        manager = db.query(models.User).filter(models.User.role == "MANAGER").first()
        if not manager:
            manager = db.query(models.User).first()
        if not manager:
            return

        branches = db.query(models.Branch).all()
        if not branches:
            return

        demo_employee_names = [
            "Алихан",
            "Аружан",
            "Данияр",
            "Мадина",
            "Нурсултан",
            "Айгерим",
            "Руслан",
            "Томирис",
            "Ержан",
            "Зере",
            "Аян",
            "Сабина",
        ]

        created_employees = []
        for index, employee_name in enumerate(demo_employee_names):
            branch = branches[index % len(branches)]
            try:
                employee_id = next_employee_id_for_branch(db, branch.id)
            except ValueError:
                # Skip branches that are out of xxyy range or fully occupied.
                continue

            employee = models.Employee(
                id=employee_id, name=employee_name, branch_id=branch.id
            )
            db.add(employee)
            created_employees.append(employee)

        db.flush()

        demo_grades = [
            [97, 95, 98],
            [94, 92, 93],
            [91, 90, 92],
            [89, 88, 90],
            [87, 88, 86],
            [85, 84, 83],
            [82, 81, 84],
            [80, 79, 81],
            [78, 77, 79],
            [76, 75, 74],
            [73, 72, 71],
            [70, 69, 68],
        ]

        for employee, employee_grades in zip(created_employees, demo_grades):
            for value in employee_grades:
                db.add(
                    models.Grade(
                        value=value,
                        role_in_shift="Продавец",
                        comment="Seeded for ratings UI",
                        employee_id=employee.id,
                        manager_id=manager.id,
                    )
                )

        db.commit()


@app.get("/api")
def root():
    return {"message": "API running"}


app.include_router(branches.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(grades.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")
