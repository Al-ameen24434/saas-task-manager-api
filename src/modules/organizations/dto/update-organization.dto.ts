import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-organization.dto';

// PartialType makes all fields optional (for PATCH semantics)
// OmitType removes 'slug' — you can't change a slug after creation
// (it's used in URLs, bookmarks, integrations — changing it breaks things)
export class UpdateOrganizationDto extends PartialType(
  OmitType(CreateOrganizationDto, ['slug'] as const),
) {}