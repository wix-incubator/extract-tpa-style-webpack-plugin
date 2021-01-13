import * as webpackSources from 'webpack-sources';
import * as fs from 'fs';
import * as path from 'path';
import * as postcss from 'postcss';
import * as extractStyles from 'postcss-extract-styles';
import {extractTPACustomSyntax} from './postcssPlugin';
import * as prefixer from 'postcss-prefix-selector';
import {Result} from 'postcss';
import {createHash} from 'crypto';
import * as webpack from 'webpack';
import {generateStandaloneCssConfigFilename} from './standaloneCssConfigFilename';

const isWebpack5 = parseInt(webpack.version, 10) === 5;

// use webpack's `webpack-sources` version, if it's v5, we'll get v2.0.0
const {RawSource, ReplaceSource} = isWebpack5 ? webpack.sources : webpackSources;

class TPAStylePlugin {
  public static pluginName = 'tpa-style-webpack-plugin';
  private readonly _options;
  private readonly compilationHash: string;

  constructor(options) {
    this._options = {
      pattern: [/"\w+\([^"]*\)"/, /START|END|DIR|STARTSIGN|ENDSIGN|DEG\-START|DEG\-END/],
      ...options,
    };
    const hash = createHash('md5')
      .update(new Date().getTime().toString())
      .digest('hex');
    this.compilationHash = `__${hash.substr(0, 6)}__`;
  }

  apply(compiler) {
    const cheapModuleEvalSourceMap = isWebpack5 ? 'eval-cheap-module-source-map' : 'cheap-module-eval-source-map';
    const shouldEscapeContent = [cheapModuleEvalSourceMap, 'cheap-eval-source-map'].includes(
      compiler.options.devtool
    );
    this.replaceRuntimeModule(compiler);

    compiler.hooks.compilation.tap(TPAStylePlugin.pluginName, compilation => {
      compilation.hooks.optimizeChunkAssets.tapAsync(TPAStylePlugin.pluginName, (chunks, callback) => {
        this.extract(compilation, chunks)
          .then(extractResults => this.replaceSource(compilation, extractResults, shouldEscapeContent))
          .then(() => callback())
          .catch(callback);
      });
    });
  }

  private replaceRuntimeModule(compiler) {
    const runtimePath = path.resolve(__dirname, '../../runtime.js');
    const nmrp = new webpack.NormalModuleReplacementPlugin(/runtime\.js$/, resource => {
      if (isWebpack5) {
        // `resource`, `request`, and `loaders` are exposed under `createData`
        // in webpack v5
        resource = resource.createData;
      }

      if (fs.realpathSync(resource.resource) !== runtimePath) {
        return;
      }

      const dirname = path.dirname(resource.resource);
      resource.request = './dist/runtime/main.js';
      resource.resource = path.join(dirname, 'dist/runtime/main.js');

      resource.loaders.push({
        loader: path.join(__dirname, 'runtimeLoader.js'),
        options: JSON.stringify({compilationHash: this.compilationHash}),
      });
    });
    nmrp.apply(compiler);
  }

  private extract(compilation, chunks) {
    const promises = [];

    chunks.forEach(chunk => {
      promises.push(
        ...chunk.files
          .filter(fileName => fileName.endsWith('.css'))
          .map(cssFile =>
            postcss([extractStyles(this._options)])
              .use(prefixer({prefix: this.compilationHash, exclude: [/^\w+/]}))
              .process(compilation.assets[cssFile].source(), {from: cssFile, to: cssFile})
              .then((result: Result & {extracted: string}) => {
                compilation.assets[cssFile] = new RawSource(
                  result.css.replace(new RegExp(`${this.compilationHash} `, 'g'), '')
                );

                return new Promise(resolve => {
                  postcss([
                    prefixer({
                      prefix: this.compilationHash,
                    }),
                    extractTPACustomSyntax({
                      onFinish: ({cssVars, customSyntaxStrs, css}) => {
                        resolve({chunk, cssVars, customSyntaxStrs, css, staticCss: result.css});
                      },
                    }),
                  ]).process(result.extracted, {from: undefined}).css;
                });
              })
          )
      );
    });

    return Promise.all(promises);
  }

  private getPlaceholderContent(params: object, shouldEscapeContent: boolean) {
    const content = JSON.stringify(params);

    if (!shouldEscapeContent) {
      return content;
    }

    const escapedContent = JSON.stringify(content);
    return escapedContent.substring(1, escapedContent.length - 1);
  }

  private replaceByPlaceHolder({sourceCode, newSource, shouldEscapeContent, placeholder, params}) {
    const placeHolder = `'${this.compilationHash}${placeholder}'`;
    const placeHolderPos = sourceCode.indexOf(placeHolder);

    if (placeHolderPos > -1) {
      newSource.replace(
        placeHolderPos,
        placeHolderPos + placeHolder.length - 1,
        this.getPlaceholderContent(params, shouldEscapeContent)
      );
    }
  }

  private generateStandaloneCssConfig({shouldEscapeContent, params}) {
    const sourceCode = fs.readFileSync(path.join(__dirname, './cssConfigTemplate.js')).toString();

    return new RawSource(
      sourceCode.replace(`'CSS_CONFIG_PLACEHOLDER'`, this.getPlaceholderContent(params, shouldEscapeContent))
    );
  }

  private replaceSource(compilation, extractResults, shouldEscapeContent) {
    const entryMergedChunks = this.getEntryMergedChunks(extractResults);

    entryMergedChunks.forEach(({chunk, cssVars, customSyntaxStrs, css, staticCss}) => {
      chunk.files
        .filter(fileName => fileName.endsWith('.js'))
        .forEach(file => {
          const sourceCode = compilation.assets[file].source();
          const newSource = new ReplaceSource(compilation.assets[file], file);

          this.replaceByPlaceHolder({
            sourceCode,
            newSource,
            shouldEscapeContent,
            placeholder: 'INJECTED_DATA_PLACEHOLDER',
            params: {
              cssVars,
              customSyntaxStrs,
              css,
            },
          });

          this.replaceByPlaceHolder({
            sourceCode,
            newSource,
            shouldEscapeContent,
            placeholder: 'INJECTED_STATIC_DATA_PLACEHOLDER',
            params: {
              staticCss,
            },
          });

          const cssConfigFilename = generateStandaloneCssConfigFilename(file);

          const params = {
            cssVars,
            customSyntaxStrs,
            css,
            staticCss,
            compilationHash: this.compilationHash,
          };

          compilation.assets[cssConfigFilename] = this.generateStandaloneCssConfig({
            shouldEscapeContent,
            params,
          });

          compilation.assets[file] = newSource;
        });
    });
  }

  private getEntryMergedChunks(extractResults) {
    const entryMergedChunks = extractResults
      .filter(({chunk}) => chunk.canBeInitial())
      .reduce((chunkMap, currentResult) => {
        const currentChunk = currentResult.chunk;
        if (chunkMap.hasOwnProperty(currentChunk.id)) {
          chunkMap[currentChunk.id] = this.mergeExtractResults(chunkMap[currentChunk.id], currentResult);
        } else {
          chunkMap[currentChunk.id] = currentResult;
        }
        return chunkMap;
      }, {});

    return Object.keys(entryMergedChunks).map(key => entryMergedChunks[key]);
  }

  private mergeExtractResults(extractResult1, extractResult2) {
    const newResult = {...extractResult1};

    newResult.cssVars = {...newResult.cssVars, ...extractResult2.cssVars};
    newResult.customSyntaxStrs = newResult.customSyntaxStrs.concat(extractResult2.customSyntaxStrs);
    newResult.css += `\n${extractResult2.css}`;
    newResult.staticCss += `\n${extractResult2.staticCss}`;

    return newResult;
  }
}

module.exports = TPAStylePlugin;
