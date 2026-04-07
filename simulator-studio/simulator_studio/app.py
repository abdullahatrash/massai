from __future__ import annotations

import copy
import json
import time
from datetime import date
from typing import Any

import streamlit as st

try:
    from .clients import HttpError, KeycloakAdminClient, MassaiClient
    from .config import StudioSettings
    from .runtime import SimulationManager
    from .storage import StudioStorage
    from .templates import get_template, list_templates, load_scenarios
except ImportError:
    from simulator_studio.clients import HttpError, KeycloakAdminClient, MassaiClient
    from simulator_studio.config import StudioSettings
    from simulator_studio.runtime import SimulationManager
    from simulator_studio.storage import StudioStorage
    from simulator_studio.templates import get_template, list_templates, load_scenarios


st.set_page_config(
    page_title="MaaSAI Factory Simulator Studio",
    page_icon="🏭",
    layout="wide",
)


@st.cache_resource
def get_settings() -> StudioSettings:
    return StudioSettings.from_env()


@st.cache_resource
def get_storage() -> StudioStorage:
    return StudioStorage(get_settings().db_path)


def get_seeded_storage() -> StudioStorage:
    storage = get_storage()
    # Keep the persistent SQLite volume self-healing across app restarts and old demo data.
    storage.seed_scenarios(load_scenarios())
    return storage


@st.cache_resource
def get_massai_client() -> MassaiClient:
    return MassaiClient(get_settings())


@st.cache_resource
def get_keycloak_client() -> KeycloakAdminClient:
    return KeycloakAdminClient(get_settings())


@st.cache_resource
def get_runtime() -> SimulationManager:
    return SimulationManager(
        storage=get_seeded_storage(),
        massai_client=get_massai_client(),
        settings=get_settings(),
    )


def _available_scenarios(
    factory: dict[str, Any], update_type: str | None = None
) -> list[dict[str, Any]]:
    scenarios = get_seeded_storage().list_scenarios(factory["pilotType"])
    if update_type is None:
        return scenarios
    return [
        scenario for scenario in scenarios if update_type in scenario["updateTypes"]
    ]


def _default_contract_id(template_key: str, factory_key: str) -> str:
    return f"contract-{template_key}-{factory_key}-001"


def _parse_json_input(raw_value: str, *, fallback: Any) -> Any:
    try:
        return json.loads(raw_value)
    except json.JSONDecodeError:
        return fallback


def _kv_rows(data: dict[str, Any]) -> None:
    """Render a dict as compact label/value markdown rows instead of st.write(dict)."""
    for label, value in data.items():
        if value is None or value == "":
            continue
        st.markdown(
            f"<div style='display:flex;justify-content:space-between;"
            f"padding:2px 0;border-bottom:1px solid rgba(128,128,128,0.15);'>"
            f"<span style='color:rgba(128,128,128,0.9);font-size:0.85em;'>{label}</span>"
            f"<span style='font-family:ui-monospace,monospace;font-size:0.85em;'>{value}</span>"
            f"</div>",
            unsafe_allow_html=True,
        )


def _render_overview(factory: dict[str, Any]) -> None:
    st.subheader("Setup")
    with st.expander("Factory details", expanded=False):
        _kv_rows(
            {
                "Factory key": factory["factoryKey"],
                "Provider": factory["providerClientId"],
                "Agreement": factory["agreementType"],
                "Product": factory["productName"],
                "Quantity": factory["quantityTotal"],
                "Delivery": factory["deliveryDate"],
            }
        )

    st.markdown("### Milestones")
    with st.form(f"milestones-form-{factory['id']}"):
        milestones = copy.deepcopy(factory["milestones"])
        criteria_inputs: list[tuple[int, str]] = []
        for index, milestone in enumerate(milestones):
            with st.expander(
                f"{milestone['milestoneRef']} · {milestone['name']}",
                expanded=index == 0,
            ):
                milestone["name"] = st.text_input(
                    "Name",
                    value=milestone["name"],
                    key=f"milestone-name-{factory['id']}-{index}",
                )
                milestone["plannedDate"] = str(
                    st.date_input(
                        "Planned date",
                        value=date.fromisoformat(milestone["plannedDate"]),
                        key=f"milestone-date-{factory['id']}-{index}",
                    )
                )
                milestone["approvalRequired"] = st.checkbox(
                    "Approval required",
                    value=bool(milestone["approvalRequired"]),
                    key=f"milestone-approval-{factory['id']}-{index}",
                )
                raw_criteria = st.text_area(
                    "Completion criteria JSON",
                    value=json.dumps(milestone["completionCriteria"], indent=2),
                    key=f"milestone-criteria-{factory['id']}-{index}",
                )
                criteria_inputs.append((index, raw_criteria))
        if st.form_submit_button("Save milestones", type="primary"):
            invalid: list[int] = []
            for index, raw in criteria_inputs:
                try:
                    milestones[index]["completionCriteria"] = json.loads(raw)
                except json.JSONDecodeError:
                    invalid.append(index)
            if invalid:
                st.error(
                    f"Invalid JSON in milestone(s): {', '.join(str(i + 1) for i in invalid)}. Nothing saved."
                )
            else:
                get_seeded_storage().update_factory_milestones(
                    factory["id"], milestones
                )
                st.toast("Milestones saved.", icon="✅")

    with st.expander("⚙ Advanced", expanded=False):
        st.caption(
            "Draft factories can be deleted completely. Provisioned factories are archived from the Studio only — the MaaSAI contract is not touched."
        )
        is_provisioned = factory["status"] == "PROVISIONED"
        action_label = "Archive from Studio" if is_provisioned else "Delete draft factory"
        if st.button(
            f"🗑 {action_label}",
            key=f"open-cleanup-dialog-{factory['id']}",
            type="secondary",
        ):
            st.session_state[f"cleanup-dialog-open-{factory['id']}"] = True

        if st.session_state.get(f"cleanup-dialog-open-{factory['id']}"):
            _open_cleanup_dialog(factory)


def _open_cleanup_dialog(factory: dict[str, Any]) -> None:
    """Type-to-confirm destructive action. Uses st.dialog (1.35+) if available,
    otherwise falls back to an inline bordered container."""
    is_provisioned = factory["status"] == "PROVISIONED"
    title = "Archive factory" if is_provisioned else "Delete draft factory"

    def _body() -> None:
        if is_provisioned:
            st.warning(
                "This removes the factory from the Studio only. "
                "The MaaSAI contract and any historical data are preserved."
            )
        else:
            st.error(
                "This permanently deletes the draft factory and its sensors from the Studio."
            )
        st.markdown(f"To confirm, type the factory name: **`{factory['name']}`**")
        typed = st.text_input(
            "Factory name",
            key=f"cleanup-typed-{factory['id']}",
            label_visibility="collapsed",
            placeholder=factory["name"],
        )
        confirmed = (typed or "").strip() == factory["name"]
        cancel_col, confirm_col = st.columns(2)
        if cancel_col.button("Cancel", use_container_width=True, key=f"cleanup-cancel-{factory['id']}"):
            st.session_state.pop(f"cleanup-dialog-open-{factory['id']}", None)
            st.rerun()
        if confirm_col.button(
            "Archive" if is_provisioned else "Delete",
            type="primary",
            use_container_width=True,
            disabled=not confirmed,
            key=f"cleanup-confirm-{factory['id']}",
        ):
            storage = get_seeded_storage()
            if is_provisioned:
                storage.archive_factory(factory["id"])
                st.toast("Factory archived from the Studio.", icon="📦")
            else:
                storage.delete_factory(factory["id"])
                st.toast("Draft factory deleted.", icon="🗑️")
            st.session_state.pop("selected_factory_id", None)
            st.session_state.pop(f"cleanup-dialog-open-{factory['id']}", None)
            st.rerun()

    dialog_decorator = getattr(st, "dialog", None)
    if callable(dialog_decorator):
        dialog_decorator(title)(_body)()
    else:
        with st.container(border=True):
            st.markdown(f"#### {title}")
            _body()


def _render_profile_editor(factory: dict[str, Any]) -> None:
    storage = get_seeded_storage()
    profile_definition = copy.deepcopy(factory["profileDefinition"])
    st.subheader("Ingest Profile")

    mode_labels = {
        "builtin": "🏭 Built-in — bind the platform default profile (recommended for quick demos)",
        "custom": "🛠 Custom — edit fields and publish a new profile version",
    }
    profile_mode = st.radio(
        "Profile mode",
        options=["builtin", "custom"],
        format_func=lambda key: mode_labels[key],
        index=0 if factory["profileMode"] == "builtin" else 1,
        key=f"profile-mode-{factory['id']}",
        label_visibility="collapsed",
    )

    col2, col3 = st.columns(2)
    profile_key = col2.text_input(
        "Profile key",
        value=factory["profileKey"] or factory["defaultProfileKey"],
        key=f"profile-key-{factory['id']}",
        disabled=profile_mode == "builtin",
    )
    profile_version = col3.number_input(
        "Profile version",
        min_value=1,
        value=int(factory["profileVersion"] or factory["defaultProfileVersion"]),
        step=1,
        key=f"profile-version-{factory['id']}",
        disabled=profile_mode == "builtin",
    )

    update_types = list(profile_definition["updateTypes"].keys())
    edited_tables: dict[str, list[dict[str, Any]]] = {}

    if profile_mode == "builtin":
        st.info(
            "Built-in mode uses the platform default profile as-is. "
            "Switch to **Custom** to edit fields, defaults, and labels."
        )
        if st.button(
            "Save profile mode",
            key=f"save-profile-builtin-{factory['id']}",
            type="primary",
        ):
            storage.update_factory_profile(
                factory["id"],
                profile_definition=profile_definition,
                profile_key=profile_key,
                profile_version=int(profile_version),
                profile_mode=profile_mode,
            )
            st.toast("Profile mode saved.", icon="✅")
        return

    st.caption("Edit the field tables below, then save.")
    for update_type in update_types:
        update_type_definition = profile_definition["updateTypes"][update_type]
        with st.expander(update_type, expanded=update_type == update_types[0]):
            all_fields = list(update_type_definition["fields"])
            required = set(update_type_definition.get("required", []))
            defaults = dict(update_type_definition.get("defaults") or {})
            ui_fields = dict(update_type_definition.get("ui", {}).get("fields") or {})

            rows = [
                {
                    "field": field_name,
                    "included": True,
                    "required": field_name in required,
                    "label": (ui_fields.get(field_name) or {}).get("label", field_name),
                    "default (JSON)": json.dumps(defaults.get(field_name, "")),
                }
                for field_name in all_fields
            ]
            edited = st.data_editor(
                rows,
                key=f"profile-fields-table-{factory['id']}-{update_type}",
                num_rows="fixed",
                use_container_width=True,
                column_config={
                    "field": st.column_config.TextColumn("Field", disabled=True),
                    "included": st.column_config.CheckboxColumn("In profile"),
                    "required": st.column_config.CheckboxColumn("Required"),
                    "label": st.column_config.TextColumn("UI label"),
                    "default (JSON)": st.column_config.TextColumn("Default (JSON)"),
                },
            )
            edited_tables[update_type] = edited

    profile_definition["supportedUpdateTypes"] = update_types

    if st.button(
        "Save profile definition",
        key=f"save-profile-{factory['id']}",
        type="primary",
    ):
        invalid: list[str] = []
        for update_type, rows in edited_tables.items():
            update_type_definition = profile_definition["updateTypes"][update_type]
            new_fields: list[str] = []
            new_required: list[str] = []
            new_defaults: dict[str, Any] = {}
            new_ui_fields: dict[str, dict[str, Any]] = {}
            for row in rows:
                if not row.get("included"):
                    continue
                field_name = row["field"]
                new_fields.append(field_name)
                if row.get("required"):
                    new_required.append(field_name)
                try:
                    new_defaults[field_name] = json.loads(
                        row.get("default (JSON)") or '""'
                    )
                except json.JSONDecodeError:
                    invalid.append(f"{update_type}.{field_name}")
                    continue
                new_ui_fields[field_name] = {"label": row.get("label") or field_name}
            update_type_definition["fields"] = new_fields
            update_type_definition["required"] = new_required
            update_type_definition["defaults"] = new_defaults
            update_type_definition.setdefault("ui", {})
            update_type_definition["ui"]["fieldOrder"] = new_fields
            update_type_definition["ui"]["fields"] = new_ui_fields

        if invalid:
            st.error(f"Invalid JSON defaults for: {', '.join(invalid)}. Nothing saved.")
        else:
            storage.update_factory_profile(
                factory["id"],
                profile_definition=profile_definition,
                profile_key=profile_key,
                profile_version=int(profile_version),
                profile_mode=profile_mode,
            )
            st.toast("Profile definition saved.", icon="✅")


def _set_sensor_enabled(storage: StudioStorage, sensor: dict[str, Any], enabled: bool) -> None:
    storage.update_sensor(
        sensor["id"],
        name=sensor["name"],
        source_id=sensor["sourceId"],
        update_type=sensor["updateType"],
        interval_seconds=float(sensor["intervalSeconds"]),
        scenario_key=sensor["scenarioKey"],
        enabled=enabled,
    )


def _update_sensor_interval(
    storage: StudioStorage, sensor: dict[str, Any], interval_seconds: float
) -> None:
    storage.update_sensor(
        sensor["id"],
        name=sensor["name"],
        source_id=sensor["sourceId"],
        update_type=sensor["updateType"],
        interval_seconds=float(interval_seconds),
        scenario_key=sensor["scenarioKey"],
        enabled=bool(sensor["enabled"]),
    )


def _scenario_title(factory: dict[str, Any], update_type: str, scenario_key: str) -> str:
    for scenario in _available_scenarios(factory, update_type):
        if scenario["scenarioKey"] == scenario_key:
            return scenario["title"]
    return scenario_key


def _render_sensor_editor(factory: dict[str, Any], sensor: dict[str, Any]) -> None:
    """Edit form for a single sensor, used inline below the summary table."""
    storage = get_seeded_storage()
    supported_types = factory["profileDefinition"]["supportedUpdateTypes"]
    with st.form(f"sensor-form-{sensor['id']}"):
        st.markdown(f"**Editing:** `{sensor['name']}`")
        c1, c2 = st.columns(2)
        sensor_name = c1.text_input("Name", value=sensor["name"])
        source_id = c2.text_input("Source ID", value=sensor["sourceId"])

        c3, c4 = st.columns(2)
        update_type = c3.selectbox(
            "Update type",
            options=supported_types,
            index=supported_types.index(sensor["updateType"])
            if sensor["updateType"] in supported_types
            else 0,
        )
        available = _available_scenarios(factory, update_type)
        if not available:
            c4.warning("No scenarios for this update type.")
            scenario_key = sensor["scenarioKey"]
        else:
            scenario_key = c4.selectbox(
                "Scenario",
                options=[scenario["scenarioKey"] for scenario in available],
                index=next(
                    (
                        index
                        for index, scenario in enumerate(available)
                        if scenario["scenarioKey"] == sensor["scenarioKey"]
                    ),
                    0,
                ),
                format_func=lambda key, available=available: next(
                    scenario["title"]
                    for scenario in available
                    if scenario["scenarioKey"] == key
                ),
            )

        c5, c6 = st.columns(2)
        interval_seconds = c5.number_input(
            "Interval (seconds)",
            min_value=1.0,
            value=float(sensor["intervalSeconds"]),
            step=1.0,
        )
        enabled = c6.toggle("Enabled", value=bool(sensor["enabled"]))

        save_col, _, delete_col = st.columns([1, 2, 1])
        save_clicked = save_col.form_submit_button("Save", type="primary", use_container_width=True)
        delete_clicked = delete_col.form_submit_button("🗑 Delete", use_container_width=True)
        if save_clicked:
            storage.update_sensor(
                sensor["id"],
                name=sensor_name,
                source_id=source_id,
                update_type=update_type,
                interval_seconds=float(interval_seconds),
                scenario_key=scenario_key,
                enabled=enabled,
            )
            st.toast("Sensor updated.", icon="✅")
            st.rerun()
        if delete_clicked:
            storage.delete_sensor(sensor["id"])
            st.session_state.pop(f"selected-sensor-{factory['id']}", None)
            st.toast("Sensor deleted.", icon="🗑️")
            st.rerun()


def _render_add_sensor_form(factory: dict[str, Any]) -> None:
    storage = get_seeded_storage()
    with st.form(f"add-sensor-{factory['id']}", clear_on_submit=True):
        st.markdown("**Add sensor**")
        c1, c2 = st.columns(2)
        update_type = c1.selectbox(
            "Update type",
            options=factory["profileDefinition"]["supportedUpdateTypes"],
            key=f"add-sensor-update-{factory['id']}",
        )
        scenario_options = _available_scenarios(factory, update_type)
        scenario_key = c2.selectbox(
            "Scenario",
            options=[scenario["scenarioKey"] for scenario in scenario_options],
            format_func=lambda key: next(
                scenario["title"]
                for scenario in scenario_options
                if scenario["scenarioKey"] == key
            ),
            key=f"add-sensor-scenario-{factory['id']}",
        )
        c3, c4 = st.columns(2)
        sensor_name = c3.text_input("Name", value=f"{factory['pilotType'].lower()}-sensor")
        source_id = c4.text_input(
            "Source ID", value=f"{factory['factoryKey']}-{(update_type or '').lower()}-01"
        )
        c5, c6 = st.columns(2)
        interval_seconds = c5.number_input("Interval (s)", min_value=1.0, value=20.0, step=1.0)
        enabled = c6.toggle("Enabled", value=True)
        if st.form_submit_button("Add sensor", type="primary", use_container_width=True):
            storage.add_sensor(
                factory["id"],
                name=sensor_name,
                source_id=source_id,
                update_type=update_type,
                interval_seconds=float(interval_seconds),
                scenario_key=scenario_key,
                enabled=enabled,
            )
            st.toast("Sensor added.", icon="✨")
            st.rerun()


def _render_sensors(factory: dict[str, Any]) -> None:
    storage = get_seeded_storage()
    st.subheader("Sensors")
    st.caption(
        "Each sensor maps to one update stream that replays a pilot scenario into the v2 ingest API."
    )

    sensors = factory["sensors"]
    enabled_count = sum(1 for sensor in sensors if sensor["enabled"])

    # Toolbar: bulk ops + add
    bar_left, bar_mid, bar_right = st.columns([2, 2, 1])
    bar_left.metric("Sensors", f"{enabled_count}/{len(sensors)} enabled")
    with bar_mid:
        bulk_l, bulk_r = st.columns(2)
        if bulk_l.button(
            "Enable all",
            key=f"bulk-enable-{factory['id']}",
            use_container_width=True,
            disabled=not sensors or enabled_count == len(sensors),
        ):
            for sensor in sensors:
                if not sensor["enabled"]:
                    _set_sensor_enabled(storage, sensor, True)
            st.toast("All sensors enabled.", icon="🟢")
            st.rerun()
        if bulk_r.button(
            "Disable all",
            key=f"bulk-disable-{factory['id']}",
            use_container_width=True,
            disabled=not sensors or enabled_count == 0,
        ):
            for sensor in sensors:
                if sensor["enabled"]:
                    _set_sensor_enabled(storage, sensor, False)
            st.toast("All sensors disabled.", icon="⚪")
            st.rerun()
    with bar_right.popover("➕ Add", use_container_width=True):
        _render_add_sensor_form(factory)

    # Bulk interval setter
    with st.expander("Bulk: set interval for all sensors", expanded=False):
        with st.form(f"bulk-interval-{factory['id']}"):
            new_interval = st.number_input(
                "Interval (seconds)", min_value=1.0, value=20.0, step=1.0
            )
            if st.form_submit_button("Apply to all", type="primary"):
                for sensor in sensors:
                    _update_sensor_interval(storage, sensor, float(new_interval))
                st.toast(f"Interval set to {new_interval}s for {len(sensors)} sensors.", icon="✅")
                st.rerun()

    if not sensors:
        st.info("No sensors yet. Use **➕ Add** to create one.")
        return

    # Summary table
    rows = [
        {
            "id": sensor["id"],
            "On": "🟢" if sensor["enabled"] else "⚪",
            "Name": sensor["name"],
            "Update type": sensor["updateType"],
            "Scenario": _scenario_title(factory, sensor["updateType"], sensor["scenarioKey"]),
            "Interval (s)": sensor["intervalSeconds"],
            "Source ID": sensor["sourceId"],
        }
        for sensor in sensors
    ]
    st.dataframe(
        rows,
        use_container_width=True,
        hide_index=True,
        column_config={
            "id": None,  # hide
            "On": st.column_config.TextColumn("On", width="small"),
        },
    )

    # Selectbox to pick a sensor for editing — simpler than dataframe selection,
    # works on all Streamlit versions.
    sensor_id_by_label = {f"{sensor['name']} · {sensor['updateType']}": sensor["id"] for sensor in sensors}
    selected_label = st.selectbox(
        "Edit sensor",
        options=list(sensor_id_by_label.keys()),
        key=f"selected-sensor-{factory['id']}",
    )
    selected_sensor = next(
        (sensor for sensor in sensors if sensor["id"] == sensor_id_by_label[selected_label]),
        None,
    )
    if selected_sensor is not None:
        _render_sensor_editor(factory, selected_sensor)


def _preflight_checks(factory: dict[str, Any]) -> list[tuple[str, str, str]]:
    """Return a list of (severity, label, detail) for pre-provisioning checks.

    severity ∈ {"ok", "warn", "error"}.
    """
    checks: list[tuple[str, str, str]] = []

    # Profile
    profile_mode = factory["profileMode"]
    profile_def = factory["profileDefinition"]
    update_types = profile_def.get("supportedUpdateTypes") or []
    total_fields = sum(
        len(profile_def.get("updateTypes", {}).get(update_type, {}).get("fields") or [])
        for update_type in update_types
    )
    if profile_mode == "builtin":
        checks.append(("ok", "Profile mode", "Built-in (platform default)"))
    elif total_fields == 0:
        checks.append(("error", "Profile mode", "Custom profile has no fields"))
    else:
        checks.append(
            ("ok", "Profile mode", f"Custom · {len(update_types)} update types · {total_fields} fields")
        )

    # Sensors
    sensors = factory["sensors"]
    enabled_sensors = [sensor for sensor in sensors if sensor["enabled"]]
    if not sensors:
        checks.append(("warn", "Sensors", "No sensors configured (you can add them later)"))
    elif not enabled_sensors:
        checks.append(("warn", "Sensors", f"{len(sensors)} configured, none enabled"))
    else:
        checks.append(
            ("ok", "Sensors", f"{len(enabled_sensors)}/{len(sensors)} enabled")
        )

    # Milestones
    milestones = factory["milestones"]
    if not milestones:
        checks.append(("error", "Milestones", "At least one milestone is required"))
    else:
        missing_criteria = [
            milestone for milestone in milestones if not milestone.get("completionCriteria")
        ]
        if missing_criteria:
            checks.append(
                (
                    "warn",
                    "Milestones",
                    f"{len(milestones)} defined, {len(missing_criteria)} have no completion criteria",
                )
            )
        else:
            checks.append(("ok", "Milestones", f"{len(milestones)} defined"))

    # Identity
    if not factory.get("contractId"):
        checks.append(("error", "Contract ID", "Missing"))
    else:
        checks.append(("ok", "Contract ID", factory["contractId"]))

    return checks


def _render_provisioning(factory: dict[str, Any]) -> None:
    storage = get_seeded_storage()
    massai = get_massai_client()
    keycloak = get_keycloak_client()
    settings = get_settings()
    st.subheader("Provision into MaaSAI")
    st.caption(
        "Provisioning creates a real contract in MaaSAI, binds the chosen ingest profile snapshot, and grants the shared provider service account access to the contract."
    )

    if factory["status"] == "PROVISIONED":
        st.success(f"This factory is already provisioned as `{factory['contractId']}`.")
        dashboard_url = (
            f"{settings.frontend_base_url.rstrip('/')}/contracts/{factory['contractId']}"
        )
        simulator_url = (
            f"{settings.frontend_base_url.rstrip('/')}"
            f"/admin/contracts/{factory['contractId']}/testing"
        )
        link_l, link_r = st.columns(2)
        link_l.link_button("Open contract dashboard", dashboard_url, use_container_width=True)
        link_r.link_button("Open MaaSAI simulator view", simulator_url, use_container_width=True)
        return

    # Pre-flight checklist
    st.markdown("### Pre-flight checks")
    checks = _preflight_checks(factory)
    icon_map = {"ok": "✅", "warn": "⚠️", "error": "❌"}
    has_errors = any(severity == "error" for severity, _, _ in checks)
    with st.container(border=True):
        for severity, label, detail in checks:
            st.markdown(
                f"<div style='display:flex;justify-content:space-between;"
                f"padding:4px 0;border-bottom:1px solid rgba(128,128,128,0.12);'>"
                f"<span><span style='margin-right:8px;'>{icon_map[severity]}</span>"
                f"<strong>{label}</strong></span>"
                f"<span style='color:rgba(128,128,128,0.95);font-size:0.88em;"
                f"font-family:ui-monospace,monospace;'>{detail}</span></span></div>",
                unsafe_allow_html=True,
            )

    if has_errors:
        st.error("Resolve the errors above before provisioning.")
    elif any(severity == "warn" for severity, _, _ in checks):
        st.warning("Warnings present — provisioning is allowed but review them first.")

    with st.expander("Provisioning environment", expanded=False):
        _kv_rows(
            {
                "MaaSAI API": settings.massai_api_base_url,
                "Frontend": settings.frontend_base_url,
                "Provider": factory["providerClientId"],
            }
        )
        st.caption(
            "Built-in mode binds the platform default profile. Custom mode creates a versioned ingest profile and binds it to the demo contract."
        )

    profile_mode = factory["profileMode"]

    if st.button(
        "🚀 Provision demo contract",
        key=f"provision-{factory['id']}",
        type="primary",
        use_container_width=True,
        disabled=has_errors,
    ):
        try:
            profile_key = factory["profileKey"] or factory["defaultProfileKey"]
            profile_version = int(
                factory["profileVersion"] or factory["defaultProfileVersion"]
            )
            if profile_mode == "custom":
                massai.create_ingest_profile(
                    {
                        "profileKey": profile_key,
                        "factoryKey": factory["factoryKey"],
                        "pilotType": factory["pilotType"],
                        "version": profile_version,
                        "status": "ACTIVE",
                        "definition": factory["profileDefinition"],
                    }
                )

            contract_payload = {
                "contractId": factory["contractId"],
                "pilotType": factory["pilotType"],
                "factoryName": factory["name"],
                "providerId": factory["providerClientId"],
                "consumerId": factory["consumerId"],
                "productName": factory["productName"],
                "quantityTotal": factory["quantityTotal"],
                "deliveryDate": factory["deliveryDate"],
                "agreementType": factory["agreementType"],
                "status": "ACTIVE",
                "milestones": factory["milestones"],
                "profileKey": profile_key if profile_mode == "custom" else None,
                "profileVersion": profile_version if profile_mode == "custom" else None,
            }
            contract_payload = {
                key: value
                for key, value in contract_payload.items()
                if value is not None
            }
            result = massai.create_demo_contract(contract_payload)
            keycloak.allow_service_account_contract(
                factory["providerClientId"], factory["contractId"]
            )
            storage.mark_factory_provisioned(
                factory["id"],
                contract_id=result["contractId"],
                profile_key=result["ingestProfileKey"],
                profile_version=int(result["ingestProfileVersion"]),
            )
            st.success(
                f"Provisioned {result['contractId']} and synced Keycloak access."
            )
            st.session_state["active_tab"] = "Run"
            st.toast("Run Console unlocked.", icon="▶️")
            st.rerun()
        except HttpError as exc:
            st.error(str(exc))


def _render_run_console(factory: dict[str, Any]) -> None:
    runtime = get_runtime()
    storage = get_seeded_storage()
    status = runtime.get_status(factory["id"])
    st.subheader("Run Console")
    st.caption(
        "Drive the chosen sensors into MaaSAI and inspect the exact payloads and backend responses."
    )

    logs = storage.list_run_logs(factory["id"], limit=200)
    error_count = sum(
        1 for log in logs if log["status"] not in ("OK", "SUCCESS", "200")
    )

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Streaming", "● Live" if status["running"] else "Idle")
    col2.metric(
        "Enabled Sensors", sum(1 for sensor in factory["sensors"] if sensor["enabled"])
    )
    col3.metric("Total Events", len(logs))
    col4.metric("Errors", error_count)

    action_left, action_middle, action_right = st.columns(3)
    if action_left.button(
        "Run one cycle", key=f"run-once-{factory['id']}", use_container_width=True
    ):
        runtime.run_once(factory["id"])
        st.toast("Triggered one simulation cycle.", icon="▶️")
    if action_middle.button(
        "Start streaming",
        key=f"start-run-{factory['id']}",
        use_container_width=True,
        type="primary",
        disabled=status["running"],
    ):
        runtime.start(factory["id"])
        st.toast("Streaming started.", icon="🟢")
        st.rerun()
    if action_right.button(
        "Stop streaming",
        key=f"stop-run-{factory['id']}",
        use_container_width=True,
        disabled=not status["running"],
    ):
        runtime.stop(factory["id"])
        st.toast("Streaming stop requested.", icon="🔴")
        st.rerun()

    if not logs:
        st.info("No run logs yet.")
    else:
        # Compact tabular view of recent events
        recent = logs[:50]
        table_rows = [
            {
                "Time": log["createdAt"],
                "Status": log["status"],
                "Sensor": log["sensorId"] or "manual",
                "Error": (log["errorText"] or "")[:80],
            }
            for log in recent
        ]
        st.dataframe(
            table_rows,
            use_container_width=True,
            hide_index=True,
            height=320,
        )

        # Inspect a single event in detail
        log_options = {
            f"{log['createdAt']} · {log['status']} · {log['sensorId'] or 'manual'}": log
            for log in recent
        }
        selected_label = st.selectbox(
            "Inspect event",
            options=list(log_options.keys()),
            key=f"inspect-log-{factory['id']}",
        )
        selected_log = log_options[selected_label]
        detail_left, detail_right = st.columns(2)
        with detail_left:
            st.markdown("**Request**")
            if selected_log["request"] is not None:
                st.json(selected_log["request"])
            else:
                st.caption("No request payload.")
        with detail_right:
            st.markdown("**Response**")
            if selected_log["response"] is not None:
                st.json(selected_log["response"])
            else:
                st.caption("No response payload.")
        if selected_log["errorText"]:
            st.error(selected_log["errorText"])

    # Auto-refresh while streaming so live events surface without manual reloads.
    if status["running"]:
        st.caption("Auto-refreshing every 3s while streaming…")
        time.sleep(3)
        st.rerun()


_TAB_LABELS = ["Setup", "Profile", "Sensors", "Provision", "Run"]


def _status_badge(status: str) -> str:
    """Return a small colored markdown chip for a factory status."""
    color_map = {
        "PROVISIONED": ("#0f766e", "#d1fae5"),
        "DRAFT": ("#92400e", "#fef3c7"),
        "ARCHIVED": ("#475569", "#e2e8f0"),
    }
    fg, bg = color_map.get(status, ("#475569", "#e2e8f0"))
    return (
        f"<span style='background:{bg};color:{fg};padding:2px 10px;"
        f"border-radius:999px;font-size:0.75em;font-weight:600;"
        f"letter-spacing:0.03em;'>{status}</span>"
    )


def _render_create_factory_form(storage: StudioStorage) -> str | None:
    """Render the 'create new factory' form. Returns the new factory id if created."""
    templates = list_templates()
    with st.form("create-factory-form", clear_on_submit=False):
        st.markdown("**New factory**")
        template_key = st.selectbox(
            "Starter pilot",
            options=[template["templateKey"] for template in templates],
            format_func=lambda key: get_template(key)["name"],
        )
        template = get_template(template_key)
        st.caption(template["description"])
        name = st.text_input("Factory name", value=f"{template['name']} Demo")
        factory_key = st.text_input("Factory key", value=f"{template_key}-demo")
        product_name = st.text_input("Product name", value=template["productName"])
        c1, c2 = st.columns(2)
        quantity_total = c1.number_input(
            "Quantity",
            min_value=1,
            value=int(template["quantityTotal"]),
            step=1,
        )
        delivery_date = c2.date_input(
            "Delivery date",
            value=date.fromisoformat(template["deliveryDate"]),
        )
        if st.form_submit_button("Create factory", type="primary", use_container_width=True):
            created = storage.create_factory_from_template(
                template,
                name=name,
                factory_key=factory_key,
                contract_id=_default_contract_id(template_key, factory_key),
                product_name=product_name,
                quantity_total=int(quantity_total),
                delivery_date=delivery_date.isoformat(),
            )
            st.toast(f"Created '{created['name']}'.", icon="✨")
            return created["id"]
    return None


def _render_sidebar(
    settings: StudioSettings,
    storage: StudioStorage,
    selected_factory_id: str | None,
) -> str | None:
    """Render the sidebar: env, factory list, create form, operator guide link."""
    factories = storage.list_factories()
    with st.sidebar:
        st.markdown("### 🏭 Studio")

        # Search + status filter
        query = st.text_input(
            "Search factories",
            placeholder="Name, contract, pilot…",
            label_visibility="collapsed",
            key="factory-search",
        )
        status_filter = st.radio(
            "Status filter",
            options=["All", "Draft", "Provisioned"],
            index=0,
            horizontal=True,
            label_visibility="collapsed",
            key="factory-status-filter",
        ) or "All"

        def _matches(factory: dict[str, Any]) -> bool:
            if status_filter == "Draft" and factory["status"] != "DRAFT":
                return False
            if status_filter == "Provisioned" and factory["status"] != "PROVISIONED":
                return False
            if query:
                hay = " ".join(
                    str(factory.get(key, "") or "")
                    for key in ("name", "contractId", "pilotType", "factoryKey")
                ).lower()
                if query.lower() not in hay:
                    return False
            return True

        filtered = [factory for factory in factories if _matches(factory)]

        st.caption(f"{len(filtered)} of {len(factories)} factories")

        if not filtered:
            st.info("No factories match the current filter.")
        for factory in filtered:
            is_active = factory["id"] == selected_factory_id
            label = f"{'▸ ' if is_active else ''}{factory['name']}"
            if st.button(
                label,
                key=f"sidebar-factory-{factory['id']}",
                use_container_width=True,
                type="primary" if is_active else "secondary",
            ):
                st.session_state["selected_factory_id"] = factory["id"]
                selected_factory_id = factory["id"]
                st.rerun()
            st.markdown(
                f"<div style='margin:-8px 0 10px 8px;font-size:0.75em;color:rgba(128,128,128,0.9);'>"
                f"{factory['pilotType']} · {factory['status']}"
                f"</div>",
                unsafe_allow_html=True,
            )

        st.divider()
        with st.expander("➕ New factory", expanded=not factories):
            new_id = _render_create_factory_form(storage)
            if new_id:
                st.session_state["selected_factory_id"] = new_id
                selected_factory_id = new_id
                st.rerun()

        st.divider()
        with st.expander("Environment", expanded=False):
            _kv_rows(
                {
                    "DB": str(settings.db_path),
                    "API": settings.massai_api_base_url,
                    "Realm": settings.keycloak_realm,
                }
            )
        st.caption(
            "Open the `Operator Guide` page from the sidebar page list for a walkthrough."
        )
    return selected_factory_id


def _render_factory_header(factory: dict[str, Any], settings: StudioSettings) -> None:
    """Persistent header strip above the tabs: identity + primary CTA."""
    with st.container(border=True):
        top_left, top_right = st.columns([3, 1.2])
        with top_left:
            st.markdown(
                f"### {factory['name']} &nbsp; {_status_badge(factory['status'])}",
                unsafe_allow_html=True,
            )
            st.markdown(
                f"<div style='font-size:0.85em;color:rgba(128,128,128,0.95);"
                f"font-family:ui-monospace,monospace;'>"
                f"{factory['pilotType']} · {factory['contractId']} · "
                f"profile {factory['profileKey'] or factory['defaultProfileKey']} "
                f"v{factory['profileVersion'] or factory['defaultProfileVersion']}"
                f"</div>",
                unsafe_allow_html=True,
            )
        with top_right:
            if factory["status"] == "PROVISIONED":
                if st.button(
                    "▶ Run Console",
                    key=f"hdr-run-{factory['id']}",
                    type="primary",
                    use_container_width=True,
                ):
                    st.session_state["active_tab"] = "Run"
                    st.rerun()
                simulator_url = (
                    f"{settings.frontend_base_url.rstrip('/')}"
                    f"/admin/contracts/{factory['contractId']}/testing"
                )
                st.link_button(
                    "↗ Live simulator",
                    simulator_url,
                    use_container_width=True,
                )
            else:
                if st.button(
                    "🚀 Provision",
                    key=f"hdr-provision-{factory['id']}",
                    type="primary",
                    use_container_width=True,
                ):
                    st.session_state["active_tab"] = "Provision"
                    st.rerun()


def _render_empty_state() -> None:
    """Centered empty state shown when no factory is selected."""
    st.markdown("<div style='height:60px;'></div>", unsafe_allow_html=True)
    _, mid, _ = st.columns([1, 2, 1])
    with mid:
        with st.container(border=True):
            st.markdown(
                "<div style='text-align:center;padding:20px 0;'>"
                "<div style='font-size:3em;'>🏭</div>"
                "<h3>No factory selected</h3>"
                "<p style='color:rgba(128,128,128,0.9);'>"
                "Pick a factory from the sidebar, or create a new one to begin."
                "</p>"
                "</div>",
                unsafe_allow_html=True,
            )


def main() -> None:
    settings = get_settings()
    storage = get_seeded_storage()
    selected_factory_id = st.session_state.get("selected_factory_id")

    st.title("MaaSAI Factory Simulator Studio")
    st.caption(
        "Configure a factory, edit its ingest profile, wire sensors, provision a demo contract, and stream v2 updates into MaaSAI."
    )

    selected_factory_id = _render_sidebar(settings, storage, selected_factory_id)

    if not selected_factory_id:
        _render_empty_state()
        return

    factory = storage.get_factory(selected_factory_id)
    if factory is None:
        st.session_state.pop("selected_factory_id", None)
        _render_empty_state()
        return

    _render_factory_header(factory, settings)

    # Session-state-driven tab navigation so header CTAs can switch tabs.
    is_provisioned = factory["status"] == "PROVISIONED"
    tab_display = {
        "Setup": "Setup",
        "Profile": "Profile",
        "Sensors": "Sensors",
        "Provision": "Provision" if not is_provisioned else "Provision ✓",
        "Run": "Run" if is_provisioned else "🔒 Run",
    }
    active_tab = st.session_state.get("active_tab", "Setup")
    if active_tab not in _TAB_LABELS:
        active_tab = "Setup"
    chosen_label = st.radio(
        "Workspace",
        options=[tab_display[label] for label in _TAB_LABELS],
        index=_TAB_LABELS.index(active_tab),
        horizontal=True,
        label_visibility="collapsed",
        key="workspace-tab-radio",
    )
    chosen = next(
        (label for label, display in tab_display.items() if display == chosen_label),
        "Setup",
    )
    if chosen != active_tab:
        st.session_state["active_tab"] = chosen
        active_tab = chosen

    if active_tab == "Setup":
        _render_overview(factory)
    elif active_tab == "Profile":
        _render_profile_editor(factory)
    elif active_tab == "Sensors":
        _render_sensors(factory)
    elif active_tab == "Provision":
        _render_provisioning(factory)
    elif active_tab == "Run":
        if not is_provisioned:
            with st.container(border=True):
                st.markdown("### 🔒 Run Console is locked")
                st.write(
                    "This factory is still a draft. Provision it first to unlock streaming."
                )
                if st.button(
                    "🚀 Go to Provision",
                    type="primary",
                    key=f"locked-run-cta-{factory['id']}",
                ):
                    st.session_state["active_tab"] = "Provision"
                    st.rerun()
        else:
            _render_run_console(factory)


if __name__ == "__main__":
    main()
