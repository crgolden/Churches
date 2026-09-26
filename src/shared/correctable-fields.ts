export const CorrectableFieldKeys = {
  canonicalName: 'canonicalName',
  street: 'street',
  city: 'city',
  state: 'state',
  zip: 'zip',
  phoneNumber: 'phoneNumber',
  website: 'website',
  emailAddress: 'emailAddress',
  primaryLanguage: 'primaryLanguage',
  worshipStyle: 'worshipStyle',
  denominationId: 'denominationId',
  wheelchairAccessible: 'wheelchairAccessible',
  hasNursery: 'hasNursery',
  hasYouthProgram: 'hasYouthProgram',
} as const;

export const FieldKinds = {
  text: 'text',
  worshipStyle: 'worshipStyle',
  denomination: 'denomination',
  boolean: 'boolean',
} as const;

export const CORRECTABLE_FIELDS = [
  { key: CorrectableFieldKeys.canonicalName, label: 'Church name', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.street, label: 'Street', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.city, label: 'City', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.state, label: 'State', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.zip, label: 'ZIP code', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.phoneNumber, label: 'Phone number', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.website, label: 'Website', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.emailAddress, label: 'Email address', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.primaryLanguage, label: 'Primary language', kind: FieldKinds.text },
  { key: CorrectableFieldKeys.worshipStyle, label: 'Worship style', kind: FieldKinds.worshipStyle },
  { key: CorrectableFieldKeys.denominationId, label: 'Denomination', kind: FieldKinds.denomination },
  { key: CorrectableFieldKeys.wheelchairAccessible, label: 'Wheelchair accessible', kind: FieldKinds.boolean },
  { key: CorrectableFieldKeys.hasNursery, label: 'Nursery', kind: FieldKinds.boolean },
  { key: CorrectableFieldKeys.hasYouthProgram, label: 'Youth program', kind: FieldKinds.boolean },
] as const;

export type CorrectableField = typeof CORRECTABLE_FIELDS[number]['key'];
export type FieldKind = typeof CORRECTABLE_FIELDS[number]['kind'];
