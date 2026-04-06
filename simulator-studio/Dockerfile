FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /workspace/simulator-studio

COPY simulator-studio /workspace/simulator-studio
COPY mock-sensors/scenarios /workspace/mock-sensors/scenarios

RUN pip install .

EXPOSE 8501

CMD ["streamlit", "run", "simulator_studio/app.py", "--server.address=0.0.0.0", "--server.port=8501"]
