from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/api/hello")
def hello():
    return JSONResponse({"message": "Hello from Vercel Serverless FastAPI!"})

handler = app
