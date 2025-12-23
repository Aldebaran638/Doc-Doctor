declare module "koffi" {
  interface KoffiLibrary {
    func(name: string, returnType: string, argTypes: string[]): any;
    [key: string]: any;
  }

  interface Koffi {
    load(path: string): KoffiLibrary;
    [key: string]: any;
  }

  const koffi: Koffi;
  export = koffi;
}
