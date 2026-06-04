export interface FilenameRule {
  mode: 'simple' | 'advanced';
  stripFormat: string;   // moment.js format (simple mode)
  matchPattern: string;  // regex to test filename (advanced mode)
  stripPattern: string;  // regex to remove from filename (advanced mode)
  targetField: string;
  fieldType: 'array' | 'value';
}

export class PluginSettings {
  public rules: FilenameRule[] = [
    {
      mode: 'simple',
      stripFormat: 'YYYY-MM-DD',
      matchPattern: '',
      stripPattern: '',
      targetField: 'aliases',
      fieldType: 'array'
    }
  ];
  public triggerOnRename = true;
  public triggerOnOpen = false;
  public triggerOnSave = false;
}
