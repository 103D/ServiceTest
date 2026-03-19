from fastapi import FastAPI
from app.routers import auth, branches, employees, grades, ratings, hello

app = FastAPI()

app.include_router(auth.router)
app.include_router(branches.router)
app.include_router(employees.router)
app.include_router(grades.router)
app.include_router(ratings.router)
app.include_router(hello.router)

@app.get("/")
def root():
    return {"status": "API running"}
