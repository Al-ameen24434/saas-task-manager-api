import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

// All fields optional — supports partial updates (PATCH semantics)
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}