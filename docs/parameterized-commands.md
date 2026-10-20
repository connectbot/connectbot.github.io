# Parameterized commands in MDX

Use the shared command components when a guide needs reader-supplied values.
Define variables once with `CommandExamples`, place `CommandInputs` where readers
should enter them, and wrap each affected fenced code block in `CommandTemplate`:

````mdx
import { CommandExamples, CommandInputs } from '@/components/CommandExamples';
import { CommandTemplate } from '@/components/CommandTemplate';

<CommandExamples variables={[{
  name: 'release',
  label: 'Release tag',
  placeholder: 'v1.11.1',
  description: 'Enter the exact release tag from GitHub.',
  pattern: '[A-Za-z0-9][A-Za-z0-9._+-]*',
  validationMessage: 'Use letters, numbers, dots, underscores, plus signs, and hyphens.',
}]}>

<CommandInputs />

<CommandTemplate>

```sh
APK='ConnectBot-{{release}}-oss.apk'
```

</CommandTemplate>

</CommandExamples>
````

Keep blank lines around the fenced block inside `CommandTemplate`. Each template
contains one fenced block and uses `{{name}}` placeholders. Ordinary Markdown,
headings, and non-templated code fences can appear anywhere inside
`CommandExamples`. Multiple templates share the same input values, and separate
`CommandExamples` groups have independent values.

All variables are required when referenced by a template. `pattern` optionally
validates the entire trimmed input using a JavaScript regular expression; define
it for shell inputs to exclude characters unsafe in that command's quoting
context. Values are substituted literally, without automatic shell escaping.
Missing or invalid values leave the placeholder visible and hide the template's
copy button. Completed templates use the site's standard code-block copy button.
Values stay in the current page and are not saved or sent to a server.
