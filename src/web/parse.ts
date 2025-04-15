export async function createParser(webAssemblyInstance: WebAssembly.Instance) {
  console.info("Creating parser...");
  console.info("Loading Prism...");
  const { parsePrism } = await import('@ruby/prism/src/parsePrism.js');
  console.info("Prism loaded successfully.");

  const parseFunc = function _parse(source: string) {
    console.info(`Parsing source (${source.length} chars)`);
    console.debug(`Source: ${source}`);
    const parseResult = parsePrism(webAssemblyInstance.exports, source);
    console.info("Parsed.");
    return parseResult;
  };
  console.info("Parser created successfully.");
  return parseFunc;
}

export type StatementInfo = {
  start: number;
  end: number;
  length: number;
  source: string;
};

export function* statements(parse: (s: string) => any, source: string): Generator<StatementInfo, void, unknown> {
  console.info("Finding statements...");
  const statements = parse(source).value.statements.childNodes();
  for (const statement of statements) {
    if (statement === null) { continue; }

    const { startOffset, length } = statement.location;
    const statementSource: string = source.substring(startOffset, startOffset + length);
    const statementInfo: StatementInfo = {
      start: startOffset, end: startOffset + length,
      length,
      source: statementSource,
    };
    yield statementInfo;
  }
  console.info("All statements retreived.");
}
