import { extractSchemas } from 'extract-pg-schema';
import rmfr from 'rmfr';

import {
  Config,
  InstantiatedConfig,
  PostRenderHook,
  PreRenderHook,
} from './config-types';
import {
  defaultGenerateIdentifierType,
  defaultGetMetadata,
  defaultGetPropertyMetadata,
  defaultPropertySortFunction,
} from './default-metadata-generators';
import defaultTypeMap from './defaultTypeMap';
import makeCompositeGenerator from './generators/makeCompositeGenerator';
import makeDomainsGenerator from './generators/makeDomainsGenerator';
import makeEnumsGenerator from './generators/makeEnumsGenerator';
import makeRangesGenerator from './generators/makeRangesGenerator';
import Output from './generators/Output';
import render from './render';
import TypeMap from './TypeMap';
import writeFile from './writeFile';

type Progress = {
  onProgressStart?: (total: number) => void;
  onProgress?: () => void;
  onProgressEnd?: () => void;
};

const markAsGenerated = (
  _path: string,
  lines: string[],
  _instantiatedConfig: InstantiatedConfig
): string[] => [
  '// @generated',
  '// This file is automatically generated by Kanel. Do not modify manually.',
  '',
  ...lines,
  '',
];

const processDatabase = async (
  config: Config,
  progress?: Progress
): Promise<void> => {
  const schemas = await extractSchemas(config.connection, {
    schemas: config.schemas,
    typeFilter: config.typeFilter,
    ...progress,
  });

  const typeMap: TypeMap = {
    ...defaultTypeMap,
    ...config.customTypeMap,
  };

  const getMetadata = config.getMetadata ?? defaultGetMetadata;
  const getPropertyMetadata =
    config.getPropertyMetadata ?? defaultGetPropertyMetadata;
  const generateIdentifierType =
    config.generateIdentifierType ?? defaultGenerateIdentifierType;
  const propertySortFunction =
    config.propertySortFunction ?? defaultPropertySortFunction;

  const instantiatedConfig: InstantiatedConfig = {
    getMetadata,
    getPropertyMetadata,
    generateIdentifierType,
    propertySortFunction,
    typeMap,
    schemas,
    outputPath: config.outputPath ?? '.',
    preDeleteOutputFolder: config.preDeleteOutputFolder ?? false,
    resolveViews: config.resolveViews ?? true,
  };

  const tableGenerator = makeCompositeGenerator('table', instantiatedConfig);
  const viewGenerator = makeCompositeGenerator('view', instantiatedConfig);
  const materializedViewGenerator = makeCompositeGenerator(
    'materializedView',
    instantiatedConfig
  );
  const compositeTypeGenerator = makeCompositeGenerator(
    'compositeType',
    instantiatedConfig
  );
  const enumGenerator = makeEnumsGenerator('enum', instantiatedConfig);
  const rangeGenerator = makeRangesGenerator(instantiatedConfig);
  const domainGenerator = makeDomainsGenerator(instantiatedConfig);

  let output: Output = {};
  Object.values(schemas).forEach((schema) => {
    output = tableGenerator(schema, output);
    output = viewGenerator(schema, output);
    output = materializedViewGenerator(schema, output);
    output = enumGenerator(schema, output);
    output = rangeGenerator(schema, output);
    output = domainGenerator(schema, output);
    output = compositeTypeGenerator(schema, output);
  });

  const preRenderHooks: PreRenderHook[] = config.preRenderHooks ?? [];
  preRenderHooks.forEach((hook) => (output = hook(output, instantiatedConfig)));

  let filesToWrite = Object.keys(output).map((path) => {
    const lines = render(output[path].declarations, path);
    return { fullPath: `${path}.ts`, lines };
  });

  const postRenderHooks: PostRenderHook[] = [
    markAsGenerated,
    ...(config.postRenderHooks ?? []),
  ];

  filesToWrite = filesToWrite.map(({ fullPath, lines }) =>
    postRenderHooks.reduce(
      (acc, hook) => ({
        fullPath,
        lines: hook(fullPath, acc.lines, instantiatedConfig),
      }),
      { fullPath, lines }
    )
  );

  if (instantiatedConfig.preDeleteOutputFolder) {
    console.info(` - Clearing old files in ${instantiatedConfig.outputPath}`);
    await rmfr(instantiatedConfig.outputPath, { glob: true });
  }

  filesToWrite.forEach(writeFile);
};

export default processDatabase;
