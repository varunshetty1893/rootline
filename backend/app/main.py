import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from . import models
from .config import settings
from .database import Base, engine
from .routers import auth, people

logger = logging.getLogger("rootline.api")

# Dev convenience: create tables if they don't exist.
# For production, use Alembic migrations instead of relying on this.
Base.metadata.create_all(bind=engine)

# The project originally shipped without relationship metadata columns.
# Add them lazily for existing installations so old family data remains
# readable while new records can distinguish adoption, step/unknown links,
# and remarriage/separation.
with engine.begin() as connection:
    existing = {column["name"] for column in inspect(engine).get_columns("family_children")}
    if "relationship_type" not in existing:
        connection.execute(text("ALTER TABLE family_children ADD COLUMN relationship_type VARCHAR"))
    existing_units = {column["name"] for column in inspect(engine).get_columns("family_units")}
    if "relationship_status" not in existing_units:
        connection.execute(text("ALTER TABLE family_units ADD COLUMN relationship_status VARCHAR"))

app = FastAPI(title="Rootline API", version="1.0.0")

allowed_origins = [settings.frontend_url]
if settings.environment.lower() != "production":
    allowed_origins.append("http://127.0.0.1:5173")

app.add_middleware(
    CORSMiddleware,
    # Vite may expose the local preview on either localhost or 127.0.0.1.
    # CORS treats those as separate origins, so allow both during local use.
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(people.router)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request, exc):
    # Keep field-level details out of production responses while retaining
    # enough server-side context to diagnose malformed requests.
    logger.warning(
        "Request validation failed: method=%s path=%s errors=%s",
        request.method,
        request.url.path,
        len(exc.errors()),
    )
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid request data."},
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request, exc):
    logger.exception(
        "Database error: method=%s path=%s",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "The service could not complete that request."},
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request, exc):
    logger.exception(
        "Unhandled server error: method=%s path=%s",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred."},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
