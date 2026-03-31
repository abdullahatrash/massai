import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContractUpdateTypeSpec,
  JsonSchema,
  UiFieldSchema,
} from "@/api/ingestSpec";

import { FormField } from "./FormField";

type SchemaDrivenFormProps = {
  errors: Record<string, string>;
  onChange: (nextDraft: Record<string, unknown>) => void;
  spec: ContractUpdateTypeSpec;
  value: Record<string, unknown>;
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getRootProperties(spec: ContractUpdateTypeSpec) {
  return spec.jsonSchema.properties ?? {};
}

function getRequiredFields(spec: ContractUpdateTypeSpec) {
  return spec.jsonSchema.required ?? [];
}

function getFieldOrder(spec: ContractUpdateTypeSpec) {
  const explicitOrder = spec.uiSchema.fieldOrder ?? [];
  const fallbackFields = Object.keys(getRootProperties(spec));
  return explicitOrder.length > 0 ? explicitOrder : fallbackFields;
}

function getFieldUi(spec: ContractUpdateTypeSpec, fieldName: string) {
  return spec.uiSchema.fields?.[fieldName] ?? {};
}

function hasMeaningfulObjectValue(value: Record<string, unknown>): boolean {
  return Object.values(value).some((item) => {
    if (item === null || item === undefined) {
      return false;
    }
    if (typeof item === "string") {
      return item.trim().length > 0;
    }
    if (typeof item === "number" || typeof item === "boolean") {
      return true;
    }
    if (Array.isArray(item)) {
      return item.length > 0;
    }
    if (typeof item === "object") {
      return hasMeaningfulObjectValue(item as Record<string, unknown>);
    }
    return true;
  });
}

function toUiValue(schema: JsonSchema, value: unknown, uiField: UiFieldSchema): unknown {
  if (uiField.widget === "multiline-list") {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
  }

  if (schema.type === "array" && schema.items?.type === "object") {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) =>
      buildUiDraftFromObjectSchema(schema.items as JsonSchema, (item ?? {}) as Record<string, unknown>, uiField.itemFields ?? {}),
    );
  }

  if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number") {
      return "";
    }
    if (uiField.displayAs === "percentage") {
      const percentValue = Math.round(value * 1000) / 10;
      return Number.isInteger(percentValue) ? String(percentValue) : String(percentValue);
    }
    return String(value);
  }

  if (schema.type === "boolean") {
    return Boolean(value);
  }

  if (schema.type === "array") {
    return Array.isArray(value) ? deepClone(value) : [];
  }

  return typeof value === "string" ? value : "";
}

function buildUiDraftFromObjectSchema(
  schema: JsonSchema,
  payload: Record<string, unknown>,
  uiFields: Record<string, UiFieldSchema>,
) {
  const properties = schema.properties ?? {};
  const nextDraft: Record<string, unknown> = {};
  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    nextDraft[fieldName] = toUiValue(fieldSchema, payload[fieldName], uiFields[fieldName] ?? {});
  }
  return nextDraft;
}

export function buildDraftFromSpec(spec: ContractUpdateTypeSpec) {
  const mergedPayload = {
    ...(spec.defaults ?? {}),
    ...(spec.initialPayload ?? {}),
  };
  return buildUiDraftFromObjectSchema(
    spec.jsonSchema,
    mergedPayload,
    spec.uiSchema.fields ?? {},
  );
}

function convertValue(
  schema: JsonSchema,
  uiField: UiFieldSchema,
  rawValue: unknown,
  path: string,
  required: boolean,
): { errors: Record<string, string>; include: boolean; value?: unknown } {
  const errors: Record<string, string> = {};

  if (uiField.widget === "multiline-list") {
    const items = String(rawValue ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (required && items.length === 0) {
      errors[path] = "At least one entry is required.";
      return { errors, include: false };
    }
    return { errors, include: items.length > 0, value: items };
  }

  if (schema.type === "array" && schema.items?.type === "object") {
    const nextItems: Record<string, unknown>[] = [];
    const itemValues = Array.isArray(rawValue) ? rawValue : [];
    itemValues.forEach((item, index) => {
      const itemSchema = schema.items as JsonSchema;
      const itemProperties = itemSchema.properties ?? {};
      const itemRequired = new Set(itemSchema.required ?? []);
      const nextItem: Record<string, unknown> = {};
      for (const [fieldName, fieldSchema] of Object.entries(itemProperties)) {
        const itemUiField = uiField.itemFields?.[fieldName] ?? {};
        const result = convertValue(
          fieldSchema,
          itemUiField,
          (item as Record<string, unknown>)[fieldName],
          `${path}.${index}.${fieldName}`,
          itemRequired.has(fieldName),
        );
        Object.assign(errors, result.errors);
        if (result.include) {
          nextItem[fieldName] = result.value;
        }
      }
      if (hasMeaningfulObjectValue(nextItem)) {
        nextItems.push(nextItem);
      }
    });
    if (required && nextItems.length === 0) {
      errors[path] = "At least one item is required.";
      return { errors, include: false };
    }
    return { errors, include: nextItems.length > 0, value: nextItems };
  }

  if (schema.type === "number" || schema.type === "integer") {
    const rawText = String(rawValue ?? "").trim();
    if (!rawText) {
      if (required) {
        errors[path] = "This field is required.";
      }
      return { errors, include: false };
    }
    const parsed = Number(rawText.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      errors[path] = "Enter a valid number.";
      return { errors, include: false };
    }
    const normalizedValue = uiField.displayAs === "percentage" ? parsed / 100 : parsed;
    if (schema.minimum !== undefined && normalizedValue < schema.minimum) {
      errors[path] = `Value must be at least ${schema.minimum}.`;
    }
    if (schema.maximum !== undefined && normalizedValue > schema.maximum) {
      errors[path] = `Value must be at most ${schema.maximum}.`;
    }
    return {
      errors,
      include: true,
      value: schema.type === "integer" ? Math.round(normalizedValue) : normalizedValue,
    };
  }

  if (schema.type === "boolean") {
    return { errors, include: true, value: Boolean(rawValue) };
  }

  const normalizedText = String(rawValue ?? "").trim();
  if (!normalizedText) {
    if (required) {
      errors[path] = "This field is required.";
    }
    return { errors, include: false };
  }
  if (schema.enum && !schema.enum.includes(normalizedText)) {
    errors[path] = "Choose a valid option.";
  }
  if (schema.pattern) {
    const pattern = new RegExp(schema.pattern);
    if (!pattern.test(normalizedText)) {
      errors[path] = "Value does not match the expected format.";
    }
  }
  return { errors, include: true, value: normalizedText };
}

export function buildPayloadFromDraft(
  spec: ContractUpdateTypeSpec,
  draft: Record<string, unknown>,
) {
  const properties = getRootProperties(spec);
  const requiredFields = new Set(getRequiredFields(spec));
  const payload: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const fieldName of getFieldOrder(spec)) {
    const fieldSchema = properties[fieldName];
    if (!fieldSchema) {
      continue;
    }
    const result = convertValue(
      fieldSchema,
      getFieldUi(spec, fieldName),
      draft[fieldName],
      fieldName,
      requiredFields.has(fieldName),
    );
    Object.assign(errors, result.errors);
    if (result.include) {
      payload[fieldName] = result.value;
    }
  }

  return {
    errors,
    payload: Object.keys(errors).length > 0 ? null : payload,
  };
}

function updateFieldValue(
  draft: Record<string, unknown>,
  fieldName: string,
  nextValue: unknown,
) {
  return {
    ...draft,
    [fieldName]: nextValue,
  };
}

function updateArrayObjectFieldValue(
  draft: Record<string, unknown>,
  fieldName: string,
  itemIndex: number,
  nestedField: string,
  nextValue: unknown,
) {
  const nextItems = Array.isArray(draft[fieldName]) ? [...(draft[fieldName] as Record<string, unknown>[])] : [];
  const currentItem = nextItems[itemIndex] ?? {};
  nextItems[itemIndex] = {
    ...currentItem,
    [nestedField]: nextValue,
  };
  return {
    ...draft,
    [fieldName]: nextItems,
  };
}

function addArrayObjectItem(
  draft: Record<string, unknown>,
  fieldName: string,
  itemSchema: JsonSchema,
  itemUiFields: Record<string, UiFieldSchema>,
) {
  const nextItems = Array.isArray(draft[fieldName]) ? [...(draft[fieldName] as Record<string, unknown>[])] : [];
  nextItems.push(buildUiDraftFromObjectSchema(itemSchema, {}, itemUiFields));
  return {
    ...draft,
    [fieldName]: nextItems,
  };
}

function removeArrayObjectItem(
  draft: Record<string, unknown>,
  fieldName: string,
  itemIndex: number,
) {
  const nextItems = Array.isArray(draft[fieldName]) ? [...(draft[fieldName] as Record<string, unknown>[])] : [];
  nextItems.splice(itemIndex, 1);
  return {
    ...draft,
    [fieldName]: nextItems,
  };
}

function renderPrimitiveField(
  fieldName: string,
  schema: JsonSchema,
  uiField: UiFieldSchema,
  value: unknown,
  error: string | undefined,
  onChange: (nextValue: unknown) => void,
) {
  const label = uiField.label ?? fieldName;
  const layout = uiField.widget === "multiline-list" || uiField.widget === "textarea" ? "wide" : "default";

  if (schema.type === "boolean" || uiField.widget === "toggle") {
    return (
      <FormField error={error} label={label} layout={layout}>
        <>
          <Button
            className="justify-start"
            onClick={() => onChange(!Boolean(value))}
            size="sm"
            type="button"
            variant={Boolean(value) ? "default" : "outline"}
          >
            {Boolean(value) ? "Enabled" : "Disabled"}
          </Button>
          {uiField.helpText ? (
            <p className="text-[0.68rem] text-slate-400">{uiField.helpText}</p>
          ) : null}
        </>
      </FormField>
    );
  }

  if (uiField.widget === "multiline-list" || uiField.widget === "textarea") {
    return (
      <FormField error={error} label={label} layout={layout}>
        <>
          <Textarea
            className="bg-white/[0.03]"
            onChange={(event) => onChange(event.target.value)}
            placeholder={uiField.placeholder}
            rows={uiField.widget === "multiline-list" ? 4 : 3}
            value={String(value ?? "")}
          />
          {uiField.helpText ? (
            <p className="text-[0.68rem] text-slate-400">{uiField.helpText}</p>
          ) : null}
        </>
      </FormField>
    );
  }

  if (schema.enum && schema.enum.length > 0) {
    return (
      <FormField error={error} label={label} layout={layout}>
        <>
          <Select onValueChange={(nextValue) => onChange(nextValue)} value={String(value ?? "") || undefined}>
            <SelectTrigger className="w-full bg-white/[0.03]">
              <SelectValue placeholder={uiField.placeholder ?? "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {schema.enum.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {uiField.helpText ? (
            <p className="text-[0.68rem] text-slate-400">{uiField.helpText}</p>
          ) : null}
        </>
      </FormField>
    );
  }

  return (
    <FormField error={error} label={label} layout={layout}>
      <>
        <Input
          className="bg-white/[0.03]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={uiField.placeholder}
          step={schema.type === "number" ? "0.1" : schema.type === "integer" ? "1" : undefined}
          type={schema.type === "number" || schema.type === "integer" ? "number" : schema.format === "date" ? "date" : "text"}
          value={String(value ?? "")}
        />
        {uiField.helpText ? (
          <p className="text-[0.68rem] text-slate-400">{uiField.helpText}</p>
        ) : null}
      </>
    </FormField>
  );
}

function renderArrayObjectField(
  fieldName: string,
  schema: JsonSchema,
  uiField: UiFieldSchema,
  value: unknown,
  errors: Record<string, string>,
  onChange: (nextDraft: Record<string, unknown>) => void,
  draft: Record<string, unknown>,
) {
  const itemSchema = schema.items as JsonSchema;
  const itemProperties = itemSchema.properties ?? {};
  const itemOrder = itemUiFieldOrder(uiField, itemProperties);
  const items = Array.isArray(value) ? value : [];

  return (
    <div className="grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {uiField.label ?? fieldName}
          </p>
          {uiField.helpText ? (
            <p className="mt-1 text-[0.72rem] text-slate-400">{uiField.helpText}</p>
          ) : null}
        </div>
        <Button
          onClick={() =>
            onChange(addArrayObjectItem(draft, fieldName, itemSchema, uiField.itemFields ?? {}))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Add {uiField.itemLabel ?? "item"}
        </Button>
      </div>

      {errors[fieldName] ? <p className="text-[0.68rem] text-rose-400">{errors[fieldName]}</p> : null}

      <div className="grid gap-3">
        {items.map((item, index) => (
          <div
            className="grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3"
            key={`${fieldName}-${index}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {(uiField.itemLabel ?? "Item")} {index + 1}
              </p>
              <Button
                onClick={() => onChange(removeArrayObjectItem(draft, fieldName, index))}
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {itemOrder.map((nestedFieldName) => {
                const nestedSchema = itemProperties[nestedFieldName];
                if (!nestedSchema) {
                  return null;
                }
                const nestedUiField = uiField.itemFields?.[nestedFieldName] ?? {};
                return (
                  <div key={nestedFieldName}>
                    {renderPrimitiveField(
                      nestedFieldName,
                      nestedSchema,
                      nestedUiField,
                      (item as Record<string, unknown>)[nestedFieldName],
                      errors[`${fieldName}.${index}.${nestedFieldName}`],
                      (nextValue) =>
                        onChange(
                          updateArrayObjectFieldValue(
                            draft,
                            fieldName,
                            index,
                            nestedFieldName,
                            nextValue,
                          ),
                        ),
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function itemUiFieldOrder(
  uiField: UiFieldSchema,
  properties: Record<string, JsonSchema>,
) {
  const explicitOrder = Object.keys(uiField.itemFields ?? {});
  return explicitOrder.length > 0 ? explicitOrder : Object.keys(properties);
}

function renderField(
  spec: ContractUpdateTypeSpec,
  fieldName: string,
  draft: Record<string, unknown>,
  errors: Record<string, string>,
  onChange: (nextDraft: Record<string, unknown>) => void,
) {
  const schema = getRootProperties(spec)[fieldName];
  if (!schema) {
    return null;
  }
  const uiField = getFieldUi(spec, fieldName);
  const value = draft[fieldName];

  if (schema.type === "array" && schema.items?.type === "object") {
    return renderArrayObjectField(fieldName, schema, uiField, value, errors, onChange, draft);
  }

  return renderPrimitiveField(
    fieldName,
    schema,
    uiField,
    value,
    errors[fieldName],
    (nextValue) => onChange(updateFieldValue(draft, fieldName, nextValue)),
  );
}

export function SchemaDrivenForm({
  errors,
  onChange,
  spec,
  value,
}: SchemaDrivenFormProps) {
  const groups = spec.uiSchema.groups ?? [];
  const groupedFields = new Set(groups.flatMap((group) => group.fields));
  const ungroupedFields = getFieldOrder(spec).filter((fieldName) => !groupedFields.has(fieldName));

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div className="space-y-3" key={group.id}>
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.title}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((fieldName) => (
              <div className={getFieldUi(spec, fieldName).widget === "object-array" ? "sm:col-span-2" : ""} key={fieldName}>
                {renderField(spec, fieldName, value, errors, onChange)}
              </div>
            ))}
          </div>
        </div>
      ))}

      {ungroupedFields.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {ungroupedFields.map((fieldName) => (
            <div className={getFieldUi(spec, fieldName).widget === "object-array" ? "sm:col-span-2" : ""} key={fieldName}>
              {renderField(spec, fieldName, value, errors, onChange)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
