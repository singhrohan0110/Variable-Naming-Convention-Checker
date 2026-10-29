# Variable Naming Convention Checker Using Compiler Design Principles

## Introduction
A browser-based, compiler-inspired tool that scans C, C++ and Java variable declarations, builds a token stream and a symbol table, and validates every identifier against lexical rules and naming conventions. It uses only HTML5, CSS3 and vanilla JavaScript. No backend, no database, no external API.

## Problem statement
Inconsistent or illegal variable names cause compile errors and hurt readability. Students and teams need a tool that shows, using real compiler phases, why a name is accepted or rejected and which convention it follows.

## Objectives
- Implement a character-by-character lexical analyzer.
- Recognise keywords, identifiers, numbers, operators, separators, strings and comments.
- Extract declarations from tokens and build a symbol table.
- Detect invalid identifiers, reserved words and duplicate declarations.
- Detect camelCase, snake_case, PascalCase, UPPER_SNAKE_CASE and lowercase, and report kebab-case as invalid.
- Report ERROR, WARNING, INFO and SUCCESS diagnostics with line numbers, without stopping at the first error.

## Features
Dashboard with statistics cards, editor with line numbers, token table, variable analysis table with filter (All/Valid/Invalid/Warning/Duplicate) and search, symbol table, diagnostics panel, recommended-convention selector, 11 built-in test cases, sample loader, dark responsive UI.

## Compiler construction concepts used
Lexical analysis, tokenization, lexemes and token classes, keyword table, identifier recognition (a regular expression `[A-Za-z_][A-Za-z0-9_]*`), symbol table with scope, simplified semantic analysis (duplicate declaration), error detection and recovery, diagnostics.

## System requirements
Any modern browser (Chrome, Edge, Firefox, Safari). No installation.

## Technology used
HTML5, CSS3, JavaScript (ES6).

## Project structure
```
variable-naming-checker/
├── index.html      page structure
├── style.css       dark IDE-style theme
├── script.js       lexer, extractor, validators, renderers
├── README.md
└── sample-code.txt sample input
```

## How the lexical analyzer works
`tokenize(code)` walks the source one character at a time with an index `i`, a line counter and a line-start offset (so column = `i - lineStart + 1`). At each position it decides which token class starts there, consumes the longest matching lexeme (maximal munch), records `{type, lexeme, line, col}` and continues. Whitespace is skipped, newlines increment the line number.

## How tokenization works
- `//` and `/* */` comments become COMMENT tokens (block comments track newlines).
- `"..."` and `'...'` become STRING tokens; an unterminated string is flagged.
- A letter or `_` starts a word; the word is looked up in the keyword table (`isKeyword`) and becomes KEYWORD, TYPE (String, string, size_t) or IDENTIFIER.
- A digit starts a number. If letters follow (like `2student`) it is not a valid number, so it becomes an invalid IDENTIFIER token and is reported later.
- Three- and two-character operators are tried before single characters. `;,(){}[]` are separators. Anything else (`@ # $`) is UNKNOWN. The tokenizer never stops on an error.

## How variable extraction works
`extractVariables(tokens, code)` works on tokens, not on raw text. For each token it tries the pattern `[modifiers] TYPE declarator {, declarator} ;` where a declarator is `name [= value]`. Pointers, array brackets, commas inside parentheses and missing semicolons (end of line recovery) are handled. Function definitions are skipped. The name is the source text spanning the declarator's name tokens, so `student-name`, `student name` and `student@name` are captured whole and then rejected by validation. Braces create block scopes (`global`, `local#n`).

## Naming convention rules
| Convention | Rule | Example |
|---|---|---|
| camelCase | starts lowercase, later words capitalised | studentName |
| snake_case | lowercase words joined by `_` | student_name |
| PascalCase | every word capitalised | StudentName |
| UPPER_SNAKE_CASE | uppercase words joined by `_` | STUDENT_NAME |
| lowercase | one lowercase word (accepted by camelCase, snake_case, lowercase) | age |
| kebab-case | INVALID in C/C++/Java | student-name |

Identifier rules: must start with a letter or `_`; only letters, digits, `_`; no spaces or symbols; not a reserved keyword; not empty. Warnings (not errors): single character, very long (over 30), leading/trailing/double underscores, confusing look-alikes (`l`, `I`, `O`, `0`), mismatch with the selected convention, and inconsistent conventions across variables.

## Symbol table explanation
Each declared name is stored as Name, Data Type, Scope, Line, Convention, Status. A duplicate is detected when the same name appears twice in the same scope; the error shows both line numbers.

## Error detection
Errors (make the variable Invalid): digit start, spaces, hyphen, special characters, reserved keyword, missing name, duplicate, unterminated string/comment. Warnings are style issues only.

## How to run
Open `index.html` in a browser. Click **Load Sample** then **Analyze Code**, or pick a test case.

## Sample input
```
int studentName;
int 2student;
int class;
int age;
float age;
int x;
```

## Sample output
```
1  SUCCESS  'studentName' follows camelCase convention.
2  ERROR    Identifier '2student' cannot begin with a digit.
3  ERROR    'class' is a reserved keyword and cannot be used as a variable name.
5  ERROR    Duplicate declaration of 'age'. First declared at line 4, redeclared at line 5.
6  WARNING  Variable 'x' is too short (single character).
```

## Future enhancements
Support functions, parameters and classes; full scope tracking per function; export report as PDF/CSV; configurable rules; a recursive-descent parser for declarations; more languages (Python, C#, Go); auto-fix suggestions (rename to the selected convention).

## Conclusion
The project demonstrates the front end of a compiler (lexical analysis plus symbol table plus simple semantic checks) in a practical, visual way and is useful as a naming linter for students.

## Relation to compiler phases
```
Source Code
   ↓
Lexical Analysis
   ↓
Tokens
   ↓
Identifier Recognition
   ↓
Symbol Table
   ↓
Naming Convention Validation
   ↓
Diagnostics
```
This project mainly implements **lexical analysis and identifier validation**, with a simplified **symbol table and semantic analysis** layer (duplicate declarations, reserved words). It does not build a parse tree, check types or generate code.

## Abstract
This project presents a web-based Variable Naming Convention Checker built on compiler construction principles. A hand-written lexical analyzer converts source code into tokens, a token-driven extractor identifies variable declarations, and a symbol table stores each variable. Identifiers are validated against lexical rules and classified as camelCase, snake_case, PascalCase, UPPER_SNAKE_CASE or lowercase. Errors, warnings and duplicates are reported with line numbers while analysis continues past mistakes. The tool runs entirely in the browser with HTML, CSS and JavaScript.

## Demonstration steps for the professor
1. Open `index.html`; explain the dashboard. 2. Click Load Sample, then Analyze Code. 3. Show the token table (Token, Lexeme, Type, Line, Position) and point out `2student` as an invalid identifier token. 4. Show the symbol table. 5. Change the convention to snake_case and re-analyze to show new warnings. 6. Use filters and search. 7. Run Test 4 (keyword), Test 6 (duplicate) and "Error recovery" from the test menu.

## Viva questions
1. **What is a compiler?** A program that translates source code of one language into another (usually machine code).
2. **What are the phases of a compiler?** Lexical, syntax, semantic analysis, intermediate code, optimisation, code generation.
3. **Which phases does this project cover?** Lexical analysis, identifier recognition, symbol table and simple semantic checks.
4. **What is a lexical analyzer?** The phase that reads characters and groups them into tokens.
5. **Token vs lexeme vs pattern?** Token is the class (IDENTIFIER), lexeme the actual text (`age`), pattern the rule describing it.
6. **How are identifiers recognised here?** By the regular expression `[A-Za-z_][A-Za-z0-9_]*`.
7. **What is maximal munch?** The lexer always takes the longest possible lexeme, e.g. `<<=` instead of `<`.
8. **Why not split code on spaces?** `a=b;` has no spaces, and strings/comments contain spaces; a real scanner is needed.
9. **How are keywords handled?** A word is checked in a keyword table after being scanned as an identifier.
10. **What is a symbol table?** A data structure storing names with attributes such as type, scope and line.
11. **How are duplicates found?** A Map keyed by scope and name; a second insertion is a redeclaration.
12. **Lexical vs semantic error?** `2student` is lexical/syntactic; duplicate declaration needs the symbol table, so it is semantic.
13. **What is error recovery?** Continuing analysis after an error so later errors are also reported.
14. **How does this tool recover?** Invalid names are still recorded, and a missing `;` ends a declaration at the line end.
15. **Why is kebab-case invalid?** `-` is the minus operator, so `student-name` lexes as three tokens.
16. **Why is `class` rejected?** It is a reserved word that the language uses for syntax.
17. **What is a finite automaton?** A state machine that accepts a regular language; it models the identifier pattern.
18. **Which data structure holds scope?** A block stack giving each block an id (`global`, `local#n`).
19. **Does it use eval()?** No; the input is only processed as text, so no user code runs.
20. **How can this be extended?** Add a parser for functions and classes, per-function scopes, type checking and auto-fix.
