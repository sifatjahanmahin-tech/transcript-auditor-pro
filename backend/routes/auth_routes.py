"""
Authentication routes — Google OAuth2 login/callback + device code flow.
"""

from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import (
    GOOGLE_AUTH_URL,
    GOOGLE_SCOPES,
    create_access_token,
    exchange_google_code,
    get_current_user,
    get_google_auth_url,
    get_or_create_google_user,
    poll_device_token,
    request_device_code,
)
from backend.config import get_settings
from backend.database import User, get_db
from backend.schemas import (
    DeviceCodeResponse,
    DeviceTokenRequest,
    GoogleAuthURL,
    MobileTokenRequest,
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


@router.get("/mobile/login")
async def mobile_google_login(
    callback_url: str | None = Query(None, description="Deep-link URL the app wants the token delivered to"),
):
    """
    Redirect the mobile app browser directly to Google OAuth.

    The caller supplies a `callback_url` (e.g. exp://... in Expo Go or
    transcriptauditor:// in a native build).  That URL is base64-encoded
    into the OAuth `state` parameter so the callback endpoint can redirect
    the token back to the correct scheme.
    """
    import base64
    import json

    settings = get_settings()

    if callback_url:
        state_payload = json.dumps({"type": "mobile", "callback": callback_url})
        state = base64.urlsafe_b64encode(state_payload.encode()).decode().rstrip("=")
    else:
        state = "mobile"

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.MOBILE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str | None = Query(None, description="OAuth state parameter"),
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Google OAuth2 callback for both web and mobile.

    State can be:
    - "mobile"                → legacy; redirects to transcriptauditor://auth/callback
    - base64-encoded JSON     → {"type":"mobile","callback":"<deep-link-url>"}
    - absent/other            → web flow; redirects to frontend
    """
    import base64
    import json

    settings = get_settings()
    is_mobile = False
    mobile_callback: str | None = None

    if state:
        if state == "mobile":
            is_mobile = True
        else:
            try:
                # Restore stripped padding
                padded = state + "=" * (-len(state) % 4)
                payload = json.loads(base64.urlsafe_b64decode(padded).decode())
                if payload.get("type") == "mobile":
                    is_mobile = True
                    mobile_callback = payload.get("callback")
            except Exception:
                pass

    redirect_uri = settings.MOBILE_REDIRECT_URI if is_mobile else settings.GOOGLE_REDIRECT_URI
    google_data = await exchange_google_code(code, redirect_uri=redirect_uri)
    user_info = google_data["user_info"]

    user = await get_or_create_google_user(
        db=db,
        google_sub=user_info["sub"],
        email=user_info["email"],
        name=user_info.get("name"),
        picture=user_info.get("picture"),
    )

    token = create_access_token(data={"sub": str(user.id), "email": user.email})

    if is_mobile:
        destination = mobile_callback or "transcriptauditor://auth/callback"
        sep = "&" if "?" in destination else "?"
        return RedirectResponse(url=f"{destination}{sep}token={token}")

    frontend_url = settings.FRONTEND_URL
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


@router.post("/mobile/token")
async def mobile_token(
    request: MobileTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange a Google authorization code (PKCE flow) for our backend JWT.
    Used by the Expo mobile app after the OAuth redirect.
    """
    import httpx

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": request.code,
                "client_id": get_settings().GOOGLE_CLIENT_ID,
                "redirect_uri": request.redirect_uri,
                "code_verifier": request.code_verifier,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=f"Google token exchange failed: {token_resp.text}")

    tokens = token_resp.json()

    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
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
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


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
