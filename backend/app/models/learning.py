from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from app.database import Base


class LearningEvent(Base):
    __tablename__ = "learning_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_word = Column(String(100), nullable=False, index=True)
    predicted_word = Column(String(100), nullable=True)
    correct_word = Column(String(100), nullable=False, index=True)
    context_prev2 = Column(String(100), nullable=True)
    context_prev1 = Column(String(100), nullable=True)
    source = Column(String(40), nullable=False, default="user")
    weight = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class UserConfusion(Base):
    __tablename__ = "user_confusions"
    __table_args__ = (
        UniqueConstraint("user_id", "observed_char", "expected_char", name="uq_user_confusion"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    observed_char = Column(String(2), nullable=False)
    expected_char = Column(String(2), nullable=False)
    weight_sum = Column(Float, nullable=False, default=0.0)
    occurrences = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserBigram(Base):
    __tablename__ = "user_bigrams"
    __table_args__ = (
        UniqueConstraint("user_id", "first_word", "second_word", name="uq_user_bigram"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    first_word = Column(String(100), nullable=False)
    second_word = Column(String(100), nullable=False)
    weight_sum = Column(Float, nullable=False, default=0.0)
    occurrences = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserTrigram(Base):
    __tablename__ = "user_trigrams"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "first_word",
            "second_word",
            "third_word",
            name="uq_user_trigram",
        ),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    first_word = Column(String(100), nullable=False)
    second_word = Column(String(100), nullable=False)
    third_word = Column(String(100), nullable=False)
    weight_sum = Column(Float, nullable=False, default=0.0)
    occurrences = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserWordStat(Base):
    __tablename__ = "user_word_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "word", name="uq_user_word_stat"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    word = Column(String(100), nullable=False)
    weight_sum = Column(Float, nullable=False, default=0.0)
    accepted_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RankerTrainingExample(Base):
    __tablename__ = "ranker_training_examples"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    feedback_uid = Column(String(64), nullable=False, index=True)
    word = Column(String(100), nullable=False)
    features_json = Column(Text, nullable=False)
    label = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
