"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var arg = require("arg");
var _a = arg({
    "--suppress": [String],
    "--compiler": String,
    "--project": String,
    "-p": "--project",
    "--createSourceFile": String,
    "--watch": Boolean,
    "-w": "--watch",
    "--stats": Boolean,
    "--help": Boolean,
    "--suppressConfig": Boolean,
}), arg_ = _a._, _b = _a["--suppress"], argSuppress = _b === void 0 ? [] : _b, _c = _a["--compiler"], argCompiler = _c === void 0 ? "node_modules/typescript/lib/typescript.js" : _c, argProject = _a["--project"], argCreateSourceFile = _a["--createSourceFile"], _d = _a["--watch"], argWatch = _d === void 0 ? false : _d, _e = _a["--stats"], argStats = _e === void 0 ? false : _e, _f = _a["--help"], argHelp = _f === void 0 ? false : _f, _g = _a["--suppressConfig"], argSuppressConfig = _g === void 0 ? false : _g;
var argv = {
    _: arg_,
    suppress: argSuppress,
    compiler: argCompiler,
    project: argProject,
    createSourceFile: argCreateSourceFile,
    watch: argWatch,
    stats: argStats,
    help: argHelp,
    suppressConfig: argSuppressConfig,
};
if (!argv.project || argv.help || argv._.length > 2) {
    printUsage();
    process.exit(1);
}
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var ts = __importStar(require("typescript"));
// @ts-ignore
ts = require(path.resolve(argv.compiler));
var config = argv.suppressConfig
    ? require(path.resolve(argv.suppressConfig))
    : null;
var supressConfig = config
    ? parseSuppressRules(config.suppress)
    : argv.suppress.map(prepareSuppressArg);
console.log("Using TypeScript compiler version " + ts.version + " from " + path.resolve(argv.compiler));
var formatHost = {
    getCanonicalFileName: function (filename) { return filename; },
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: function () { return ts.sys.newLine; },
};
if (argv.createSourceFile) {
    var originalCreateSourceFile = ts.createSourceFile;
    // @ts-ignore
    ts.createSourceFile = require(process.cwd() + "/" + argv.createSourceFile)(originalCreateSourceFile);
}
if (argv.watch) {
    var watchDiagnostics_1 = [];
    var createProgram = ts.createSemanticDiagnosticsBuilderProgram;
    var watchCompilerHost = ts.createWatchCompilerHost(argv.project, {}, ts.sys, createProgram, function reportDiagnostic(diagnostic) {
        watchDiagnostics_1.push(diagnostic);
    }, function reportWatchStatusChanged(diagnostic) {
        if (diagnostic.code === 6031 || diagnostic.code === 6032) {
            // Starting compilation | File change detected
            process.stdout.write("\u001b[2J\u001b[0;0H"); // clear console
            watchDiagnostics_1 = [];
            assertDiagnostics(diagnostic, formatHost, false);
        }
        else if (diagnostic.code === 6194) {
            // Compilation done
            assertDiagnostics(diagnostic, formatHost, false);
            assertDiagnostics(watchDiagnostics_1, formatHost);
            console.log("Watching for file changes.");
        }
    });
    var origCreateProgram_1 = watchCompilerHost.createProgram;
    watchCompilerHost.createProgram = function (rootNames, options, wcHost, oldProgram) { return origCreateProgram_1(rootNames, options, wcHost, oldProgram); };
    var origPostProgramCreate_1 = watchCompilerHost.afterProgramCreate;
    watchCompilerHost.afterProgramCreate = function (program) {
        origPostProgramCreate_1(program);
    };
    ts.createWatchProgram(watchCompilerHost);
}
else {
    var configObject = ts.parseConfigFileTextToJson(argv.project, fs.readFileSync(argv.project).toString());
    assertDiagnostics(configObject.error, formatHost, false);
    var configParseResult = ts.parseJsonConfigFileContent(configObject.config, ts.sys, process.cwd(), undefined, argv.project);
    assertDiagnostics(configParseResult.errors, formatHost, false);
    var compilerHost = ts.createCompilerHost(configParseResult.options);
    var programOptions = {
        rootNames: configParseResult.fileNames,
        options: configParseResult.options,
        projectReferences: configParseResult.projectReferences,
        host: compilerHost,
        configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(configParseResult),
    };
    var program = ts.createProgram(programOptions);
    var emitResult = program.emit();
    process.exit(assertDiagnostics(ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics), compilerHost));
}
// @ts-ignore   // ********************************
return; // Only functions follow this point
// ********************************
function assertDiagnostics(diagnostics, formatDiagnosticsHost, allowSuppress) {
    if (allowSuppress === void 0) { allowSuppress = true; }
    if (!diagnostics) {
        return 0;
    }
    if (!Array.isArray(diagnostics)) {
        diagnostics = [diagnostics];
    }
    if (!diagnostics.length) {
        return 0;
    }
    var diagnosticsToShow = [];
    var suppressedDiagnostics = [];
    if (allowSuppress) {
        for (var _i = 0, diagnostics_1 = diagnostics; _i < diagnostics_1.length; _i++) {
            var d = diagnostics_1[_i];
            if (isSuppressed(d.code, d.file && d.file.fileName)) {
                suppressedDiagnostics.push(d);
            }
            else {
                diagnosticsToShow.push(d);
            }
        }
    }
    else {
        diagnosticsToShow = diagnostics;
    }
    if (diagnosticsToShow.length) {
        // console.(error | warn) does not allow to grep output (OS X)
        console.log(ts.formatDiagnosticsWithColorAndContext(diagnosticsToShow, formatDiagnosticsHost));
    }
    if (allowSuppress) {
        if (argv.stats) {
            console.log(JSON.stringify(getStatistics(suppressedDiagnostics), null, "  "));
        }
        console.warn("Visible errors: " + diagnosticsToShow.length + ", suppressed errors: " + suppressedDiagnostics.length);
    }
    if (diagnosticsToShow.length) {
        return 2;
    }
    return 0;
}
function prepareSuppressArg(arg) {
    var suppress = {
        codes: [],
        pathRegExp: null,
    };
    var pathIndex = arg.indexOf("@");
    if (pathIndex === -1) {
        console.error("Cannot parse suppression '" + arg + "'");
        printUsage();
        process.exit(1);
    }
    if (pathIndex > 0) {
        suppress.codes = arg.substr(0, pathIndex).split(",").map(Number);
    }
    if (pathIndex < arg.length - 1) {
        suppress.pathRegExp = new RegExp(arg.substr(pathIndex + 1));
    }
    return suppress;
}
function parseSuppressRules(suppressRules) {
    return suppressRules.map(function (rule) { return (__assign({}, rule, { pathRegExp: new RegExp(rule.pathRegExp) })); });
}
function isSuppressed(code, fileName) {
    if (!fileName) {
        return false;
    }
    for (var _i = 0, supressConfig_1 = supressConfig; _i < supressConfig_1.length; _i++) {
        var suppress = supressConfig_1[_i];
        if (suppress.codes.length && suppress.codes.indexOf(code) === -1) {
            continue;
        }
        if (suppress.pathRegExp && !suppress.pathRegExp.test(fileName)) {
            continue;
        }
        return true;
    }
    return false;
}
function getStatistics(suppressedDiagnostics) {
    var statistics = [];
    for (var _i = 0, supressConfig_2 = supressConfig; _i < supressConfig_2.length; _i++) {
        var suppress = supressConfig_2[_i];
        var statisticsItemCodes = {};
        for (var _a = 0, _b = suppress.codes; _a < _b.length; _a++) {
            var code = _b[_a];
            statisticsItemCodes[code] = 0;
        }
        var statisticsItem = {
            codes: statisticsItemCodes,
            pathRegExp: (suppress.pathRegExp || "").toString(),
            total: 0,
        };
        statistics.push(statisticsItem);
        for (var _c = 0, suppressedDiagnostics_1 = suppressedDiagnostics; _c < suppressedDiagnostics_1.length; _c++) {
            var suppressedDiag = suppressedDiagnostics_1[_c];
            if (suppress.pathRegExp &&
                suppress.pathRegExp.test(suppressedDiag.file.fileName)) {
                statisticsItem.total++;
                if (suppress.codes.length &&
                    suppress.codes.indexOf(suppressedDiag.code) !== -1) {
                    statisticsItemCodes[suppressedDiag.code]++;
                }
            }
        }
    }
    return statistics;
}
function printUsage() {
    console.log("Usage:");
    console.log("  tsc-silent --project <path> [--suppress config | --suppressConfig path] [--compiler path]");
    console.log("             [--watch]");
    console.log();
    console.log("Synopsis:");
    console.log("  --project, -p       Path to tsconfig.json");
    console.log();
    console.log("  --compiler          Path to typescript.js.");
    console.log("                      By default, uses `./node_modules/typescript/lib/typescript.js`.");
    console.log();
    console.log("  --suppress          Suppressed erros.");
    console.log("                      E.g. `--suppress 7017@src/js/ 2322,2339,2344@/src/legacy/`.");
    console.log();
    console.log("  --suppressConfig    Path to supressed errors config.");
    console.log("                      See documentation for examples.");
    console.log();
    console.log("  --watch, -w         Run in watch mode.");
    console.log();
    console.log("  --stats             Print number of suppressed errors per path and error code.");
    console.log();
    console.log(". --createSourceFile  Custom module to use in place of the default TypeScript logic");
    console.log("                      it expects a module that exports a single function, with the");
    console.log("                      original TypeScript function as sole argument.");
    console.log();
    console.log("Description:");
    console.log("The purpose of the wrapper is to execute TypeScript compiler but suppress some error messages");
    console.log("coming from certain files/folders. For example, this can be used to enable `noImplicitAny` in");
    console.log("some parts of the project while keeping it disabled in others.");
    console.log();
}
