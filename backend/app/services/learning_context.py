from contextvars import ContextVar, Token
from typing import Optional

_current_learning_user: ContextVar[Optional[int]] = ContextVar(
    "current_learning_user",
    default=None,
)


def set_learning_user(user_id: Optional[int]) -> Token:
    return _current_learning_user.set(user_id)


def reset_learning_user(token: Token) -> None:
    _current_learning_user.reset(token)


def get_learning_user() -> Optional[int]:
    return _current_learning_user.get()
