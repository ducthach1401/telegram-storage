import { BadRequestException } from '@nestjs/common';

export const DUPLICATE_NAME_POLICIES = ['reject', 'overwrite', 'suffix'] as const;

export type DuplicateNamePolicy = (typeof DUPLICATE_NAME_POLICIES)[number];

export function parseDuplicateNamePolicy(
  duplicatePolicy?: string,
  overwriteLegacy?: string | boolean,
): DuplicateNamePolicy {
  if (overwriteLegacy === true || overwriteLegacy === 'true') {
    return 'overwrite';
  }
  const raw = duplicatePolicy?.trim().toLowerCase();
  if (!raw || raw === 'reject') {
    return 'reject';
  }
  if (raw === 'overwrite' || raw === 'suffix') {
    return raw;
  }
  throw new BadRequestException(
    `duplicatePolicy phải là: ${DUPLICATE_NAME_POLICIES.join(', ')} (hoặc overwrite=true)`,
  );
}
