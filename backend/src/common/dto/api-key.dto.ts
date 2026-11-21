import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { API_KEY_SCOPES } from '../../api-keys/api-key-scopes';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes!: string[];
}
