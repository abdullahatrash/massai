from __future__ import annotations

from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


GUIDE_PATH = Path(__file__).resolve().parents[2] / "OPERATOR_GUIDE.md"

FLOW_DIAGRAM_HTML = """
<div style="background:#f7f7f5;border:1px solid #d7e3dc;border-radius:18px;padding:20px 20px 10px 20px;">
  <svg viewBox="0 0 1180 760" width="100%" role="img" aria-label="MaaSAI simulator studio flow diagram">
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#1f4d45"></path>
      </marker>
      <linearGradient id="studio" x1="0%" x2="100%">
        <stop offset="0%" stop-color="#d9fff4"></stop>
        <stop offset="100%" stop-color="#bff0de"></stop>
      </linearGradient>
      <linearGradient id="platform" x1="0%" x2="100%">
        <stop offset="0%" stop-color="#eef6ff"></stop>
        <stop offset="100%" stop-color="#dbe9ff"></stop>
      </linearGradient>
      <linearGradient id="identity" x1="0%" x2="100%">
        <stop offset="0%" stop-color="#fff4d8"></stop>
        <stop offset="100%" stop-color="#ffe7a8"></stop>
      </linearGradient>
      <linearGradient id="buyer" x1="0%" x2="100%">
        <stop offset="0%" stop-color="#fde7ee"></stop>
        <stop offset="100%" stop-color="#ffd1df"></stop>
      </linearGradient>
      <style>
        .title { font: 700 28px sans-serif; fill: #172221; }
        .section { font: 700 18px sans-serif; fill: #172221; }
        .boxTitle { font: 700 18px sans-serif; fill: #172221; }
        .boxBody { font: 14px sans-serif; fill: #29423c; }
        .small { font: 13px sans-serif; fill: #35524b; }
        .label { font: 700 13px sans-serif; fill: #1f4d45; }
      </style>
    </defs>

    <text x="30" y="42" class="title">MaaSAI Demo Flow</text>
    <text x="30" y="68" class="small">How the Simulator Studio provisions a factory, authenticates it, sends data, and drives the buyer dashboard.</text>

    <rect x="30" y="110" rx="22" ry="22" width="300" height="220" fill="url(#studio)" stroke="#7cc7ae" stroke-width="2"></rect>
    <text x="55" y="145" class="section">1. Simulator Studio</text>
    <rect x="55" y="165" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#7cc7ae"></rect>
    <text x="75" y="190" class="boxTitle">Create Factory</text>
    <text x="75" y="210" class="boxBody">Pick Factor, Tasowheel, or E4M</text>
    <rect x="55" y="232" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#7cc7ae"></rect>
    <text x="75" y="257" class="boxTitle">Configure Profile And Sensors</text>
    <text x="75" y="277" class="boxBody">Milestones, fields, update types, scenarios</text>
    <rect x="55" y="299" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#7cc7ae"></rect>
    <text x="75" y="324" class="boxTitle">Run Console</text>
    <text x="75" y="344" class="boxBody">Manual cycle or continuous streaming</text>

    <rect x="430" y="110" rx="22" ry="22" width="300" height="220" fill="url(#platform)" stroke="#98b8f6" stroke-width="2"></rect>
    <text x="455" y="145" class="section">2. MaaSAI Backend</text>
    <rect x="455" y="165" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#98b8f6"></rect>
    <text x="475" y="190" class="boxTitle">Demo Contract Provisioning</text>
    <text x="475" y="210" class="boxBody">Creates contract, milestones, profile snapshot</text>
    <rect x="455" y="232" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#98b8f6"></rect>
    <text x="475" y="257" class="boxTitle">v2 Ingest Validation</text>
    <text x="475" y="277" class="boxBody">Checks payload against contract-bound schema</text>
    <rect x="455" y="299" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#98b8f6"></rect>
    <text x="475" y="324" class="boxTitle">Monitoring And Alerts</text>
    <text x="475" y="344" class="boxBody">Updates state, milestones, alerts, notifications</text>

    <rect x="830" y="110" rx="22" ry="22" width="300" height="220" fill="url(#identity)" stroke="#d6b453" stroke-width="2"></rect>
    <text x="855" y="145" class="section">3. Keycloak Identity</text>
    <rect x="855" y="178" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#d6b453"></rect>
    <text x="875" y="203" class="boxTitle">Shared Provider Service Accounts</text>
    <text x="875" y="223" class="boxBody">One per pilot family for demo sending</text>
    <rect x="855" y="250" rx="14" ry="14" width="250" height="54" fill="#ffffff" stroke="#d6b453"></rect>
    <text x="875" y="275" class="boxTitle">Contract Access Mapping</text>
    <text x="875" y="295" class="boxBody">Studio adds contract_ids before streaming</text>

    <rect x="230" y="430" rx="22" ry="22" width="320" height="220" fill="url(#platform)" stroke="#98b8f6" stroke-width="2"></rect>
    <text x="255" y="465" class="section">4. Platform Data Layer</text>
    <rect x="255" y="485" rx="14" ry="14" width="270" height="58" fill="#ffffff" stroke="#98b8f6"></rect>
    <text x="275" y="510" class="boxTitle">PostgreSQL</text>
    <text x="275" y="530" class="boxBody">Contracts, milestones, alerts, updates, profiles</text>
    <rect x="255" y="560" rx="14" ry="14" width="270" height="58" fill="#ffffff" stroke="#98b8f6"></rect>
    <text x="275" y="585" class="boxTitle">Canonical Monitoring Model</text>
    <text x="275" y="605" class="boxBody">Stable contract shape for every factory integration</text>

    <rect x="640" y="430" rx="22" ry="22" width="320" height="220" fill="url(#buyer)" stroke="#e88aaa" stroke-width="2"></rect>
    <text x="665" y="465" class="section">5. Buyer Experience</text>
    <rect x="665" y="485" rx="14" ry="14" width="270" height="58" fill="#ffffff" stroke="#e88aaa"></rect>
    <text x="685" y="510" class="boxTitle">MaaSAI Dashboard</text>
    <text x="685" y="530" class="boxBody">Contract overview, alerts, milestones, feed</text>
    <rect x="665" y="560" rx="14" ry="14" width="270" height="58" fill="#ffffff" stroke="#e88aaa"></rect>
    <text x="685" y="585" class="boxTitle">Client Demo Moment</text>
    <text x="685" y="605" class="boxBody">Buyer sees progress without chasing suppliers</text>

    <line x1="330" y1="220" x2="430" y2="220" stroke="#1f4d45" stroke-width="4" marker-end="url(#arrow)"></line>
    <text x="345" y="205" class="label">Provision contract</text>

    <line x1="730" y1="220" x2="830" y2="220" stroke="#1f4d45" stroke-width="4" marker-end="url(#arrow)"></line>
    <text x="744" y="205" class="label">Admin sync</text>

    <line x1="980" y1="330" x2="980" y2="405" stroke="#1f4d45" stroke-width="4"></line>
    <line x1="980" y1="405" x2="800" y2="405" stroke="#1f4d45" stroke-width="4" marker-end="url(#arrow)"></line>
    <text x="830" y="392" class="label">Provider token + contract access</text>

    <line x1="390" y1="430" x2="390" y2="355" stroke="#1f4d45" stroke-width="4" marker-end="url(#arrow)"></line>
    <text x="250" y="392" class="label">Persist contract state and updates</text>

    <line x1="550" y1="540" x2="640" y2="540" stroke="#1f4d45" stroke-width="4" marker-end="url(#arrow)"></line>
    <text x="564" y="525" class="label">Read models</text>

    <line x1="330" y1="275" x2="430" y2="275" stroke="#1f4d45" stroke-width="4" marker-end="url(#arrow)"></line>
    <text x="338" y="292" class="label">v2 ingest payloads</text>

    <line x1="780" y1="540" x2="550" y2="540" stroke="#e88aaa" stroke-width="2.5" stroke-dasharray="8 8"></line>
    <text x="598" y="560" class="small">Dashboard reads normalized contract state</text>

    <line x1="230" y1="590" x2="100" y2="590" stroke="#7cc7ae" stroke-width="2.5" stroke-dasharray="8 8"></line>
    <line x1="100" y1="590" x2="100" y2="250" stroke="#7cc7ae" stroke-width="2.5" stroke-dasharray="8 8"></line>
    <line x1="100" y1="250" x2="55" y2="250" stroke="#7cc7ae" stroke-width="2.5" stroke-dasharray="8 8" marker-end="url(#arrow)"></line>
    <text x="40" y="570" class="small">Studio keeps local demo memory in SQLite</text>
  </svg>
</div>
"""


def main() -> None:
    st.set_page_config(
        page_title="Operator Guide",
        page_icon="📘",
        layout="wide",
    )
    st.title("Operator Guide")
    st.caption("Run the studio, create a factory, provision a contract, and stream data into MaaSAI without touching code.")

    col1, col2, col3 = st.columns(3)
    col1.metric("Studio", "http://localhost:3001")
    col2.metric("Dashboard", "http://localhost:3000")
    col3.metric("Backend", "http://localhost:8000")

    st.info(
        "Use the main Studio page to create and run factories. Use this guide page as the walkthrough script during client demos."
    )
    st.markdown("## Flow Diagram")
    st.caption("This is the end-to-end path from factory setup in the studio to buyer visibility in MaaSAI.")
    components.html(FLOW_DIAGRAM_HTML, height=760, scrolling=False)

    st.markdown(GUIDE_PATH.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
