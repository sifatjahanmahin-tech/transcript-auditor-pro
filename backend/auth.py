"""
Authentication module — Google OAuth2 + JWT token management.

Handles:
  - Google OAuth2 authorization URL generation
  - Google token exchange and user-info retrieval
  - JWT creation and validation
  - Device-code flow for CLI authentication
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode
from uuid import UUID

import httpx
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import User, get_db

settings = get_settings()
security = HTTPBearer(auto_error=False)

# ── Google OAuth2 endpoints ──
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_DEVICE_CODE_URL = "https://oauth2.googleapis.com/device/code"

# Scopes we request
GOOGLE_SCOPES = "openid email profile"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Claims to encode (must include 'sub').
        expires_delta: Custom expiration. Defaults to config value.

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Raises:
        HTTPException 401 if token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency: extract and validate the current user from JWT.

    Returns:
        User ORM object.

    Raises:
        HTTPException 401 if not authenticated or user not found.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    return user


async def get_or_create_google_user(
    db: AsyncSession,
    google_sub: str,
    email: str,
    name: Optional[str] = None,
    picture: Optional[str] = None,
) -> User:
    """
    Find existing user by Google sub ID, or create a new one.

    Args:
        db: Async database session.
        google_sub: Google's unique user identifier.
        email: User's email from Google.
        name: Display name.
        picture: Profile picture URL.

    Returns:
        User ORM object (existing or newly created).
    """
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user is None:
        # Check if email already exists (edge case: same email, different auth)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is not None:
            # Link existing email-based account to Google
            user.google_sub = google_sub
            if name:
                user.name = name
            if picture:
                user.picture = picture
        else:
            # Create brand new user
            user = User(
                email=email,
                name=name,
                picture=picture,
                google_sub=google_sub,
            )
            db.add(user)

        await db.commit()
        await db.refresh(user)

    return user


async def exchange_google_code(code: str) -> dict:
    """
    Exchange an authorization code for Google tokens and user info.

    Args:
        code: Authorization code from Google redirect.

    Returns:
        Dict with 'access_token', 'user_info' (email, name, picture, sub).

    Raises:
        HTTPException on failure.
    """
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google token exchange failed: {token_response.text}",
            )

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Fetch user info
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch Google user info",
            )

        user_info = userinfo_response.json()

        return {
            "access_token": access_token,
            "user_info": {
                "sub": user_info.get("sub"),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
            },
        }


def get_google_auth_url(state: Optional[str] = None) -> str:
    """
    Build the Google OAuth2 authorization URL.

    Args:
        state: Optional CSRF state parameter.

    Returns:
        Full authorization URL string.
    """
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
    }
    if state:
        params["state"] = state

    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def request_device_code() -> dict:
    """
    Request a device code for CLI authentication flow.

    Returns:
        Dict with device_code, user_code, verification_url, etc.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GOOGLE_DEVICE_CODE_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "scope": GOOGLE_SCOPES,
            },
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Device code request failed: {response.text}",
            )

        return response.json()


async def poll_device_token(device_code: str) -> Optional[dict]:
    """
    Poll Google for device token (CLI auth flow).

    Returns:
        Token dict if authorized, None if still pending.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "device_code": device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            },
        )

        data = response.json()

        if response.status_code == 200:
            return data
        elif data.get("error") == "authorization_pending":
            return None
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Device token polling failed: {data.get('error_description', data.get('error'))}",
            )
