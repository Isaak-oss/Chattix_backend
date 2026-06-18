import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export class SwaggerMetaDto {
  @ApiProperty({ required: false, example: 20 })
  limit?: number;

  @ApiProperty({ required: false })
  cursor?: string;

  @ApiProperty({ required: false })
  nextCursor?: string;

  @ApiProperty({ required: false })
  before?: string;

  @ApiProperty({ required: false })
  after?: string;

  @ApiProperty({ required: false })
  nextBefore?: string;

  @ApiProperty({ required: false })
  nextAfter?: string;

  @ApiProperty({ required: false, example: true })
  hasMore?: boolean;

  @ApiProperty({ required: false, example: true })
  hasMoreBefore?: boolean;

  @ApiProperty({ required: false, example: false })
  hasMoreAfter?: boolean;
}

export class SwaggerResponseDto {
  @ApiProperty()
  data: unknown;

  @ApiProperty({ type: SwaggerMetaDto })
  meta: SwaggerMetaDto;
}

type SwaggerWrappedResponseOptions = {
  type?: Type<unknown>;
  isArray?: boolean;
  schema?: SchemaObject;
  description?: string;
};

function getDataSchema(options: SwaggerWrappedResponseOptions): SchemaObject | ReferenceObject {
  if (options.schema) {
    return options.schema;
  }

  if (!options.type) {
    return { nullable: true };
  }

  const itemSchema = { $ref: getSchemaPath(options.type) };

  if (options.isArray) {
    return {
      type: 'array',
      items: itemSchema,
    };
  }

  return itemSchema;
}

function getWrappedSchema(options: SwaggerWrappedResponseOptions): SchemaObject {
  return {
    allOf: [
      { $ref: getSchemaPath(SwaggerResponseDto) },
      {
        properties: {
          data: getDataSchema(options),
          meta: { $ref: getSchemaPath(SwaggerMetaDto) },
        },
      },
    ],
  };
}

export function ApiWrappedOkResponse(options: SwaggerWrappedResponseOptions = {}) {
  const models: Type<unknown>[] = [SwaggerResponseDto, SwaggerMetaDto];

  if (options.type) {
    models.push(options.type);
  }

  return applyDecorators(
    ApiExtraModels(...models),
    ApiOkResponse({
      description: options.description,
      schema: getWrappedSchema(options),
    }),
  );
}

export function ApiWrappedCreatedResponse(options: SwaggerWrappedResponseOptions = {}) {
  const models: Type<unknown>[] = [SwaggerResponseDto, SwaggerMetaDto];

  if (options.type) {
    models.push(options.type);
  }

  return applyDecorators(
    ApiExtraModels(...models),
    ApiCreatedResponse({
      description: options.description,
      schema: getWrappedSchema(options),
    }),
  );
}

export function ApiEmptyResponse() {
  return ApiNoContentResponse({ description: 'No content' });
}
