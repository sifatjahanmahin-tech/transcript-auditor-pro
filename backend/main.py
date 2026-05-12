"""
Transcript Auditor Pro — FastAPI Application Entry Point.

Production-ready setup with:
  - CORS middleware for frontend communication
  - Structured route registration
  - Database initialization on startup
  - Health check endpoint
  - Graceful error handling
  - Request logging middleware
"""

import logging
import os
import sys
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import get_settings
from backend.database import Base, async_engine
from backend.routes import audit_routes, auth_routes, history_routes, mcp_routes
from backend.schemas import HealthResponse

settings = get_settings()

# ── Logging ──
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("audit_pro")


# ── Lifespan: startup + shutdown ──
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialize DB tables on startup, cleanup on shutdown."""
    logger.info("Starting Transcript Auditor Pro v%s", settings.APP_VERSION)

    # Validate OAuth config at startup so misconfigurations are obvious in logs
    cid = settings.GOOGLE_CLIENT_ID
    csec = settings.GOOGLE_CLIENT_SECRET
    if not cid:
        logger.error("GOOGLE_CLIENT_ID is not set — OAuth login will fail")
    else:
        logger.info("OAuth client_id loaded: %s...%s", cid[:8], cid[-6:])
    if not csec:
        logger.error("GOOGLE_CLIENT_SECRET is not set — OAuth token exchange will fail")
    else:
        logger.info("OAuth client_secret loaded: length=%d prefix=%s", len(csec), csec[:6])
    logger.info("GOOGLE_REDIRECT_URI = %s", settings.GOOGLE_REDIRECT_URI)
    logger.info("FRONTEND_URL        = %s", settings.FRONTEND_URL)

    # Create tables if they don't exist
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized.")
        await _seed_programs()
    except Exception as exc:
        logger.error("Database connection failed at startup: %s", exc)
        logger.error("Fix DATABASE_URL in .env and restart. API will not function until DB is connected.")

    yield  # App runs here

    # Shutdown
    await async_engine.dispose()
    logger.info("Database connections closed. Goodbye.")


async def _seed_programs():
    """Load program definitions from program.md into DB if not already present."""
    from sqlalchemy import select

    from backend.database import ProgramTemplate, async_session_factory
    from parsers.program_parser import parse_program

    program_file = None
    for path in ["program.md", "data/program.md"]:
        full_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), path)
        if os.path.isfile(full_path):
            program_file = full_path
            break

    if program_file is None:
        logger.warning("program.md not found — skipping program seeding.")
        return

    programs_to_seed = [
        "Computer Science & Engineering",
        "Electrical & Computer Engineering",
    ]

    async with async_session_factory() as db:
        for name in programs_to_seed:
            result = await db.execute(select(ProgramTemplate).where(ProgramTemplate.name == name))
            existing = result.scalar_one_or_none()

            if existing is None:
                try:
                    parsed = parse_program(program_file, name)
                    template = ProgramTemplate(
                        name=parsed.program_name,
                        total_required_credits=parsed.total_required_credits,
                        mandatory_courses=parsed.mandatory_courses,
                    )
                    db.add(template)
                    logger.info("Seeded program: %s", name)
                except Exception as e:
                    logger.warning("Failed to seed program '%s': %s", name, e)

        await db.commit()


# ── App Factory ──
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "NSU Transcript Audit API — Upload CSV or scanned transcript images, "
            "run degree audits, track history, and manage accounts."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ──
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Request Timing Middleware ──
    @app.middleware("http")
    async def timing_middleware(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        response.headers["X-Process-Time"] = f"{duration:.4f}"
        if duration > 1.0:
            logger.warning(
                "Slow request: %s %s took %.2fs",
                request.method,
                request.url.path,
                duration,
            )
        return response

    # ── Global Exception Handler ──
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred. Please try again."},
        )

    # ── Register Routes ──
    app.include_router(auth_routes.router)
    app.include_router(audit_routes.router)
    app.include_router(history_routes.router)
    app.include_router(mcp_routes.router)

    # ── Health Check ──
    @app.get("/api/health", response_model=HealthResponse, tags=["System"])
    async def health_check():
        """API health check endpoint."""
        # Check DB connectivity
        db_status = "connected"
        try:
            async with async_engine.connect() as conn:
                await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        except Exception:
            db_status = "disconnected"

        # Check OCR availability
        ocr_ok = False
        try:
            import pytesseract

            pytesseract.get_tesseract_version()
            ocr_ok = True
        except Exception:
            pass

        from fastapi.responses import JSONResponse as _JSONResponse

        oauth_ok = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
        return _JSONResponse(content={
            "status": "healthy" if db_status == "connected" else "degraded",
            "version": settings.APP_VERSION,
            "database": db_status,
            "ocr_available": ocr_ok,
            "oauth": {
                "client_id_set": bool(settings.GOOGLE_CLIENT_ID),
                "client_secret_set": bool(settings.GOOGLE_CLIENT_SECRET),
                "client_secret_length": len(settings.GOOGLE_CLIENT_SECRET),
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "frontend_url": settings.FRONTEND_URL,
            },
        })

    # ── Programs List Endpoint ──
    @app.get("/api/programs", tags=["Programs"])
    async def list_programs():
        """List all available degree programs."""
        from sqlalchemy import select

        from backend.database import ProgramTemplate, async_session_factory

        _FALLBACK_PROGRAMS = [
            {
                "id": "1",
                "name": "Computer Science & Engineering",
                "total_required_credits": 130,
                "mandatory_courses": {},
            },
            {
                "id": "2",
                "name": "Electrical & Computer Engineering",
                "total_required_credits": 132,
                "mandatory_courses": {},
            },
        ]

        try:
            async with async_session_factory() as db:
                result = await db.execute(select(ProgramTemplate))
                templates = result.scalars().all()

            if not templates:
                return {"programs": _FALLBACK_PROGRAMS}

            return {
                "programs": [
                    {
                        "id": str(t.id),
                        "name": t.name,
                        "total_required_credits": t.total_required_credits,
                        "mandatory_courses": t.mandatory_courses,
                    }
                    for t in templates
                ]
            }
        except Exception:
            logger.warning("Database unavailable for /api/programs — returning static fallback.")
            return {"programs": _FALLBACK_PROGRAMS}

    return app


# ── Create the app instance ──
app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # reload incompatible with workers > 1
        workers=1,
        log_level="debug" if settings.DEBUG else "info",
    )
