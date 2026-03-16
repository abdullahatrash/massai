FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
COPY *.py ./
COPY scenarios ./scenarios

CMD ["python", "factor_simulator.py"]
