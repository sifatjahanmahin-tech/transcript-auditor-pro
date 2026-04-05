"""
Authentication routes — Google OAuth2 login/callback + device code flow.
"""

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.auth import (
    create_access_token,
    exchange_google_code,
    get_current_user,
    get_google_auth_url,
    get_or_create_google_user,
    poll_device_token,
    request_device_code,
)
from backend.database import User, get_db
from backend.schemas import (
    DeviceCodeResponse,
    DeviceTokenRequest,
    GoogleAuthURL,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/google/login", response_model=GoogleAuthURL)
async def google_login():
    """
    Get the Google OAuth2 authorization URL.
    Frontend redirects user to this URL.
    """
    auth_url = get_google_auth_url()
    return GoogleAuthURL(auth_url=auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(..., description="Authorization code from Google"),
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Google OAuth2 callback.
    Exchanges code for tokens, creates/updates user, redirects to frontend with JWT.
    """
    # Exchange code for user info
    google_data = await exchange_google_code(code)
    user_info = google_data["user_info"]

    # Get or create user
    user = await get_or_create_google_user(
        db=db,
        google_sub=user_info["sub"],
        email=user_info["email"],
        name=user_info.get("name"),
        picture=user_info.get("picture"),
    )

    # Create JWT
    token = create_access_token(data={"sub": str(user.id), "email": user.email})

    frontend_url = get_settings().FRONTEND_URL
    return RedirectResponse(url=f"{frontend_url}/auth/callback?token={token}")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return UserResponse.model_validate(current_user)


# ── Device Code Flow (CLI) ──

@router.post("/device/code", response_model=DeviceCodeResponse)
async def device_code():
    """
    Request a device code for CLI authentication.
    User enters the code at verification_url.
    """
    result = await request_device_code()
    return DeviceCodeResponse(
        device_code=result["device_code"],
        user_code=result["user_code"],
        verification_url=result.get("verification_url", result.get("verification_uri", "")),
        expires_in=result.get("expires_in", 1800),
        interval=result.get("interval", 5),
    )


@router.post("/device/token")
async def device_token(
    request: DeviceTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Poll for device token after user has authorized via browser.
    Returns JWT once authorization is complete, or 202 if still pending.
    """
    result = await poll_device_token(request.device_code)

    if result is None:
        return Response(status_code=202, content="Authorization pending")

    # Got tokens — fetch user info
    import httpx

    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {result['access_token']}"},
        )
        user_info = userinfo_resp.json()

    user = await get_or_create_google_user(
        db=db,
        google_sub=user_info["sub"],
        email=user_info["email"],
        name=user_info.get("name"),
        picture=user_info.get("picture"),
    )

    token = create_access_token(data={"sub": str(user.id), "email": user.email})

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )
