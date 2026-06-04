export interface FilenameRule {
  matchPattern: string;
  stripPattern: string;
  targetField: string;
  fieldType: 'array' | 'value';
}

export class PluginSettings {
  public rules: FilenameRule[] = [
    {
      matchPattern: '',
      stripPattern: '^\\d{4}-\\d{2}-\\d{2}\\s*',
      targetField: 'aliases',
      fieldType: 'array'
    }
  ];
  public triggerOnRename = true;
  public triggerOnOpen = false;
  public triggerOnSave = false;
}
