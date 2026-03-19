from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.database import get_db
from app.models import Branch, User
from app.schemas import Token, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


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
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def create_user_or_raise(user_data: UserCreate, db: Session) -> User:
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=409, detail="User with this username already exists"
        )

    is_first_user = db.query(User.id).first() is None
    branch = db.query(Branch).filter(Branch.id == user_data.branch_id).first()

    # Bootstrap path for a clean database: allow creating the first ADMIN account
    # and provision a default branch so the system can be used without demo seeding.
    if is_first_user and branch is None and db.query(Branch.id).first() is None:
        if user_data.role != "ADMIN":
            raise HTTPException(
                status_code=400,
                detail="First user must have ADMIN role",
            )

        branch = Branch(name="Main Branch", city="Almaty")
        db.add(branch)
        db.flush()

    if not branch:
        raise HTTPException(status_code=400, detail="Branch not found")

    user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        branch_id=branch.id,
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid registration data")
    return user


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    return create_user_or_raise(user_data, db)


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user_by_admin(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    return create_user_or_raise(user_data, db)


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(
        {"sub": user.username, "role": user.role, "branch_id": user.branch_id}
    )
    return {"access_token": token, "token_type": "bearer"}