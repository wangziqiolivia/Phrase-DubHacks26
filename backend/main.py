from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from .database import close_client
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    close_client()


app = FastAPI(title="DubHacks JSON Records API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"],
)
app.include_router(router)


@app.exception_handler(PyMongoError)
def database_error(request: Request, exc: PyMongoError):
    # Do not expose driver messages, connection strings, or credentials.
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


@app.exception_handler(RuntimeError)
def configuration_error(request: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"detail": "Service configuration unavailable"})
