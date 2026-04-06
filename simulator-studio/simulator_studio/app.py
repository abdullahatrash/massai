from __future__ import annotations

import copy
import json
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


def _available_scenarios(factory: dict[str, Any], update_type: str | None = None) -> list[dict[str, Any]]:
    scenarios = get_seeded_storage().list_scenarios(factory["pilotType"])
    if update_type is None:
        return scenarios
    return [
        scenario
        for scenario in scenarios
        if update_type in scenario["updateTypes"]
    ]


def _default_contract_id(template_key: str, factory_key: str) -> str:
    return f"contract-{template_key}-{factory_key}-001"


def _parse_json_input(raw_value: str, *, fallback: Any) -> Any:
    try:
        return json.loads(raw_value)
    except json.JSONDecodeError:
        return fallback


def _render_catalog(selected_factory_id: str | None) -> str | None:
    storage = get_seeded_storage()
    settings = get_settings()
    templates = list_templates()
    factories = storage.list_factories()

    st.subheader("Factory Catalog")
    st.caption("Clone a starter pilot, adjust the profile and sensors, then provision a real demo contract into MaaSAI.")

    left, right = st.columns([1.3, 1.7], gap="large")
    with left:
        st.markdown("### Starter Pilots")
        for template in templates:
            with st.container(border=True):
                st.markdown(f"**{template['name']}**")
                st.caption(template["description"])
                st.write(
                    {
                        "pilotType": template["pilotType"],
                        "defaultProfile": f"{template['defaultProfileKey']} v{template['defaultProfileVersion']}",
                        "providerClientId": template["providerClientId"],
                    }
                )

        with st.form("create-factory-form"):
            template_key = st.selectbox(
                "Starting template",
                options=[template["templateKey"] for template in templates],
                format_func=lambda key: get_template(key)["name"],
            )
            template = get_template(template_key)
            default_factory_key = f"{template_key}-demo"
            name = st.text_input("Factory name", value=f"{template['name']} Demo")
            factory_key = st.text_input("Factory key", value=default_factory_key)
            product_name = st.text_input("Product name", value=template["productName"])
            quantity_total = st.number_input(
                "Quantity total",
                min_value=1,
                value=int(template["quantityTotal"]),
                step=1,
            )
            delivery_date = st.date_input(
                "Delivery date",
                value=date.fromisoformat(template["deliveryDate"]),
            )
            submitted = st.form_submit_button("Create factory")
            if submitted:
                created = storage.create_factory_from_template(
                    template,
                    name=name,
                    factory_key=factory_key,
                    contract_id=_default_contract_id(template_key, factory_key),
                    product_name=product_name,
                    quantity_total=int(quantity_total),
                    delivery_date=delivery_date.isoformat(),
                )
                st.success(f"Created factory '{created['name']}'.")
                return created["id"]

    with right:
        st.markdown("### Demo Factories")
        if not factories:
            st.info("No demo factories yet. Create one from a starter pilot.")
        for factory in factories:
            with st.container(border=True):
                top_left, top_right = st.columns([1.5, 1])
                with top_left:
                    st.markdown(f"**{factory['name']}**")
                    st.caption(factory["description"])
                with top_right:
                    st.write(
                        {
                            "status": factory["status"],
                            "contractId": factory["contractId"],
                            "pilotType": factory["pilotType"],
                        }
                    )
                if factory["id"] == selected_factory_id:
                    simulator_url = (
                        f"{settings.frontend_base_url.rstrip('/')}/simulator/{factory['contractId']}"
                    )
                    if factory["status"] == "PROVISIONED":
                        st.link_button(
                            "Open simulator",
                            simulator_url,
                            use_container_width=True,
                            type="primary",
                        )
                    else:
                        st.button(
                            "Provision to open simulator",
                            key=f"selected-factory-{factory['id']}",
                            use_container_width=True,
                            disabled=True,
                        )
                elif st.button(
                    "Open factory",
                    key=f"select-factory-{factory['id']}",
                    use_container_width=True,
                    type="secondary",
                ):
                    return factory["id"]
    return selected_factory_id


def _render_overview(factory: dict[str, Any]) -> None:
    st.subheader("Factory Setup")
    c1, c2, c3 = st.columns(3)
    c1.metric("Pilot", factory["pilotType"])
    c2.metric("Provider Client", factory["providerClientId"])
    c3.metric("Status", factory["status"])

    st.write(
        {
            "factoryKey": factory["factoryKey"],
            "contractId": factory["contractId"],
            "agreementType": factory["agreementType"],
            "productName": factory["productName"],
            "quantityTotal": factory["quantityTotal"],
            "deliveryDate": factory["deliveryDate"],
            "profile": f"{factory['profileKey']} v{factory['profileVersion']}",
        }
    )

    st.markdown("### Milestones")
    milestones = copy.deepcopy(factory["milestones"])
    for index, milestone in enumerate(milestones):
        with st.expander(f"{milestone['milestoneRef']} · {milestone['name']}", expanded=index == 0):
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
            milestone["completionCriteria"] = _parse_json_input(
                st.text_area(
                    "Completion criteria JSON",
                    value=json.dumps(milestone["completionCriteria"], indent=2),
                    key=f"milestone-criteria-{factory['id']}-{index}",
                ),
                fallback=milestone["completionCriteria"],
            )
    if st.button("Save milestones", key=f"save-milestones-{factory['id']}"):
        get_seeded_storage().update_factory_milestones(factory["id"], milestones)
        st.success("Milestones saved.")

    st.markdown("### Studio Management")
    st.caption(
        "Draft factories can be deleted completely. Provisioned factories are archived from the Studio only, because the MaaSAI contract already exists."
    )
    confirm_cleanup = st.checkbox(
        "I understand the cleanup action",
        key=f"confirm-cleanup-{factory['id']}",
    )
    if factory["status"] == "PROVISIONED":
        if st.button(
            "Archive from Studio",
            key=f"archive-factory-{factory['id']}",
            type="secondary",
            disabled=not confirm_cleanup,
        ):
            get_seeded_storage().archive_factory(factory["id"])
            st.session_state.pop("selected_factory_id", None)
            st.success(
                "Factory archived from the Studio. The MaaSAI contract was not deleted."
            )
            st.rerun()
    else:
        if st.button(
            "Delete draft factory",
            key=f"delete-factory-{factory['id']}",
            type="secondary",
            disabled=not confirm_cleanup,
        ):
            get_seeded_storage().delete_factory(factory["id"])
            st.session_state.pop("selected_factory_id", None)
            st.success("Draft factory deleted from the Studio.")
            st.rerun()


def _render_profile_editor(factory: dict[str, Any]) -> None:
    storage = get_seeded_storage()
    profile_definition = copy.deepcopy(factory["profileDefinition"])
    st.subheader("Ingest Profile")
    st.caption("Edit the cloned profile definition that will be bound to this demo contract. Built-in mode keeps the platform default untouched.")

    col1, col2, col3 = st.columns([1, 1, 1])
    profile_mode = col1.selectbox(
        "Profile mode",
        options=["builtin", "custom"],
        index=0 if factory["profileMode"] == "builtin" else 1,
        key=f"profile-mode-{factory['id']}",
    )
    profile_key = col2.text_input(
        "Profile key",
        value=factory["profileKey"] or factory["defaultProfileKey"],
        key=f"profile-key-{factory['id']}",
    )
    profile_version = col3.number_input(
        "Profile version",
        min_value=1,
        value=int(factory["profileVersion"] or factory["defaultProfileVersion"]),
        step=1,
        key=f"profile-version-{factory['id']}",
    )

    update_types = list(profile_definition["updateTypes"].keys())
    for update_type in update_types:
        update_type_definition = profile_definition["updateTypes"][update_type]
        with st.expander(update_type, expanded=update_type == update_types[0]):
            fields = list(update_type_definition["fields"])
            update_type_definition["fields"] = st.multiselect(
                "Fields",
                options=fields,
                default=fields,
                key=f"profile-fields-{factory['id']}-{update_type}",
            )
            update_type_definition["required"] = st.multiselect(
                "Required fields",
                options=update_type_definition["fields"],
                default=[field for field in update_type_definition.get("required", []) if field in update_type_definition["fields"]],
                key=f"profile-required-{factory['id']}-{update_type}",
            )
            defaults = dict(update_type_definition.get("defaults") or {})
            ui_fields = dict(update_type_definition.get("ui", {}).get("fields") or {})
            for field_name in update_type_definition["fields"]:
                with st.container(border=True):
                    default_value = defaults.get(field_name, "")
                    defaults[field_name] = _parse_json_input(
                        st.text_input(
                            f"{field_name} default (JSON)",
                            value=json.dumps(default_value),
                            key=f"profile-default-{factory['id']}-{update_type}-{field_name}",
                        ),
                        fallback=default_value,
                    )
                    ui_config = dict(ui_fields.get(field_name) or {})
                    ui_config["label"] = st.text_input(
                        f"{field_name} label",
                        value=ui_config.get("label", field_name),
                        key=f"profile-label-{factory['id']}-{update_type}-{field_name}",
                    )
                    ui_fields[field_name] = ui_config
            update_type_definition["defaults"] = defaults
            update_type_definition.setdefault("ui", {})
            update_type_definition["ui"]["fieldOrder"] = list(update_type_definition["fields"])
            update_type_definition["ui"]["fields"] = ui_fields

    profile_definition["supportedUpdateTypes"] = update_types

    if st.button("Save profile definition", key=f"save-profile-{factory['id']}"):
        storage.update_factory_profile(
            factory["id"],
            profile_definition=profile_definition,
            profile_key=profile_key,
            profile_version=int(profile_version),
            profile_mode=profile_mode,
        )
        st.success("Profile definition saved.")


def _render_sensors(factory: dict[str, Any]) -> None:
    storage = get_seeded_storage()
    st.subheader("Sensors And Data Sources")
    st.caption("Each sensor maps to one update stream that can replay a pilot scenario into the v2 ingest API.")

    for sensor in factory["sensors"]:
        with st.expander(sensor["name"], expanded=False):
            sensor_name = st.text_input("Name", value=sensor["name"], key=f"sensor-name-{sensor['id']}")
            source_id = st.text_input("Source ID", value=sensor["sourceId"], key=f"sensor-source-{sensor['id']}")
            update_type = st.selectbox(
                "Update type",
                options=factory["profileDefinition"]["supportedUpdateTypes"],
                index=factory["profileDefinition"]["supportedUpdateTypes"].index(sensor["updateType"]),
                key=f"sensor-update-type-{sensor['id']}",
            )
            available = _available_scenarios(factory, update_type)
            if not available:
                st.warning("No scenarios available for this update type yet.")
                continue
            scenario_key = st.selectbox(
                "Scenario",
                options=[scenario["scenarioKey"] for scenario in available],
                index=next(
                    (index for index, scenario in enumerate(available) if scenario["scenarioKey"] == sensor["scenarioKey"]),
                    0,
                ),
                format_func=lambda key: next(
                    scenario["title"] for scenario in available if scenario["scenarioKey"] == key
                ),
                key=f"sensor-scenario-{sensor['id']}",
            )
            interval_seconds = st.number_input(
                "Interval seconds",
                min_value=1.0,
                value=float(sensor["intervalSeconds"]),
                step=1.0,
                key=f"sensor-interval-{sensor['id']}",
            )
            enabled = st.checkbox(
                "Enabled",
                value=bool(sensor["enabled"]),
                key=f"sensor-enabled-{sensor['id']}",
            )
            action_left, action_right = st.columns(2)
            if action_left.button("Save sensor", key=f"save-sensor-{sensor['id']}"):
                storage.update_sensor(
                    sensor["id"],
                    name=sensor_name,
                    source_id=source_id,
                    update_type=update_type,
                    interval_seconds=float(interval_seconds),
                    scenario_key=scenario_key,
                    enabled=enabled,
                )
                st.success("Sensor updated.")
            if action_right.button("Delete sensor", key=f"delete-sensor-{sensor['id']}"):
                storage.delete_sensor(sensor["id"])
                st.success("Sensor deleted.")

    with st.form(f"add-sensor-{factory['id']}"):
        st.markdown("### Add sensor")
        update_type = st.selectbox(
            "Update type",
            options=factory["profileDefinition"]["supportedUpdateTypes"],
        )
        scenario_options = _available_scenarios(factory, update_type)
        sensor_name = st.text_input("Name", value=f"{factory['pilotType'].lower()}-sensor")
        source_id = st.text_input("Source ID", value=f"{factory['factoryKey']}-{update_type.lower()}-01")
        scenario_key = st.selectbox(
            "Scenario",
            options=[scenario["scenarioKey"] for scenario in scenario_options],
            format_func=lambda key: next(
                scenario["title"] for scenario in scenario_options if scenario["scenarioKey"] == key
            ),
        )
        interval_seconds = st.number_input("Interval seconds", min_value=1.0, value=20.0, step=1.0)
        enabled = st.checkbox("Enabled", value=True)
        submitted = st.form_submit_button("Add sensor")
        if submitted:
            storage.add_sensor(
                factory["id"],
                name=sensor_name,
                source_id=source_id,
                update_type=update_type,
                interval_seconds=float(interval_seconds),
                scenario_key=scenario_key,
                enabled=enabled,
            )
            st.success("Sensor added.")


def _render_provisioning(factory: dict[str, Any]) -> None:
    storage = get_seeded_storage()
    massai = get_massai_client()
    keycloak = get_keycloak_client()
    settings = get_settings()
    st.subheader("Provision Into MaaSAI")
    st.caption("Provisioning creates a real contract in MaaSAI, binds the chosen ingest profile snapshot, and grants the shared provider service account access to the contract.")

    st.write(
        {
            "massaiApiBaseUrl": settings.massai_api_base_url,
            "frontendBaseUrl": settings.frontend_base_url,
            "providerClientId": factory["providerClientId"],
        }
    )

    profile_mode = factory["profileMode"]
    st.info(
        "Built-in mode binds the platform default profile. Custom mode first creates a versioned ingest profile in MaaSAI and then binds it to the demo contract."
    )

    if st.button("Provision demo contract", key=f"provision-{factory['id']}", type="primary"):
        try:
            profile_key = factory["profileKey"] or factory["defaultProfileKey"]
            profile_version = int(factory["profileVersion"] or factory["defaultProfileVersion"])
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
                key: value for key, value in contract_payload.items() if value is not None
            }
            result = massai.create_demo_contract(contract_payload)
            keycloak.allow_service_account_contract(factory["providerClientId"], factory["contractId"])
            storage.mark_factory_provisioned(
                factory["id"],
                contract_id=result["contractId"],
                profile_key=result["ingestProfileKey"],
                profile_version=int(result["ingestProfileVersion"]),
            )
            st.success(f"Provisioned {result['contractId']} and synced Keycloak access.")
        except HttpError as exc:
            st.error(str(exc))

    dashboard_url = f"{settings.frontend_base_url.rstrip('/')}/contracts/{factory['contractId']}"
    simulator_url = f"{settings.frontend_base_url.rstrip('/')}/simulator/{factory['contractId']}"
    st.markdown(f"[Open contract dashboard]({dashboard_url})")
    st.markdown(f"[Open MaaSAI simulator view]({simulator_url})")


def _render_run_console(factory: dict[str, Any]) -> None:
    runtime = get_runtime()
    storage = get_seeded_storage()
    status = runtime.get_status(factory["id"])
    st.subheader("Run Console")
    st.caption("Drive the chosen sensors into MaaSAI and inspect the exact payloads and backend responses.")

    col1, col2, col3 = st.columns(3)
    col1.metric("Streaming", "Yes" if status["running"] else "No")
    col2.metric("Enabled Sensors", sum(1 for sensor in factory["sensors"] if sensor["enabled"]))
    col3.metric("Recent Events", len(storage.list_run_logs(factory["id"], limit=20)))

    action_left, action_middle, action_right = st.columns(3)
    if action_left.button("Run one cycle", key=f"run-once-{factory['id']}"):
        runtime.run_once(factory["id"])
        st.success("Triggered one simulation cycle.")
    if action_middle.button("Start streaming", key=f"start-run-{factory['id']}"):
        runtime.start(factory["id"])
        st.success("Streaming started.")
    if action_right.button("Stop streaming", key=f"stop-run-{factory['id']}"):
        runtime.stop(factory["id"])
        st.warning("Streaming stop requested.")

    logs = storage.list_run_logs(factory["id"], limit=25)
    if not logs:
        st.info("No run logs yet.")
        return
    for log in logs:
        with st.expander(f"{log['createdAt']} · {log['status']} · {log['sensorId'] or 'manual'}"):
            if log["request"] is not None:
                st.markdown("**Request**")
                st.json(log["request"])
            if log["response"] is not None:
                st.markdown("**Response**")
                st.json(log["response"])
            if log["errorText"]:
                st.error(log["errorText"])


def main() -> None:
    settings = get_settings()
    storage = get_seeded_storage()
    factories = storage.list_factories()
    selected_factory_id = st.session_state.get("selected_factory_id")
    sidebar_options = {factory["name"]: factory["id"] for factory in factories}

    st.title("MaaSAI Factory Simulator Studio")
    st.caption(
        "Visually set up a factory, clone a pilot ingest profile, add sensors, provision a demo contract, and stream v2 updates into MaaSAI."
    )

    with st.sidebar:
        st.markdown("### Environment")
        st.write(
            {
                "dbPath": str(settings.db_path),
                "massaiApiBaseUrl": settings.massai_api_base_url,
                "keycloakRealm": settings.keycloak_realm,
            }
        )
        st.info("Open the `Operator Guide` page from the sidebar page list for a plain-language walkthrough.")
        if sidebar_options:
            selected_name = st.selectbox(
                "Active factory",
                options=["None"] + list(sidebar_options.keys()),
                index=0 if not selected_factory_id else (list(sidebar_options.values()).index(selected_factory_id) + 1),
            )
            if selected_name != "None":
                selected_factory_id = sidebar_options[selected_name]
                st.session_state["selected_factory_id"] = selected_factory_id

    selected_factory_id = _render_catalog(selected_factory_id)
    if selected_factory_id:
        st.session_state["selected_factory_id"] = selected_factory_id

    if not selected_factory_id:
        return

    factory = storage.get_factory(selected_factory_id)
    overview_tab, profile_tab, sensors_tab, provision_tab, run_tab = st.tabs(
        ["Factory Setup", "Ingest Profile", "Sensors", "Provision", "Run Console"]
    )
    with overview_tab:
        _render_overview(factory)
    with profile_tab:
        _render_profile_editor(factory)
    with sensors_tab:
        _render_sensors(factory)
    with provision_tab:
        _render_provisioning(factory)
    with run_tab:
        _render_run_console(factory)


if __name__ == "__main__":
    main()
