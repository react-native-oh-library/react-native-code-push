import { RNPackage, UITurboModule,UITurboModuleContext,UITurboModuleFactory } from "@rnoh/react-native-openharmony/ts";
import { TM } from "@rnoh/react-native-openharmony/generated/ts";
import { CodePushNativeModule } from './CodePushNativeModule';
import { CodePushBuilder } from './CodePushBuilder';
import fs, { ReadTextOptions } from "@ohos.file.fs";
import common from '@ohos.app.ability.common';
import { bundleManager } from '@kit.AbilityKit';

class CodePushModulesFactory extends UITurboModuleFactory {
  createTurboModule(name: string): UITurboModule | null {
    if (name === TM.RTNCodePush.NAME) {
      let codePush = new CodePushBuilder().build()
      return new CodePushNativeModule(this.ctx, codePush);
    }
    return null;
  }

  hasTurboModule(name: string): boolean {
    return name === TM.RTNCodePush.NAME;
  }
}

export class CodePushPackage extends RNPackage {
  createTurboModulesFactory(ctx: UITurboModuleContext): UITurboModuleFactory {
    this.comparingVersion()
    return new CodePushModulesFactory(ctx);
  }
  comparingVersion(){
    let context = getContext(this) as common.UIAbilityContext;
    const codepushjsonpath = context.filesDir + '/CodePush/codepush.json';
    if(fs.accessSync(codepushjsonpath)){
      let bundleFlags = bundleManager.BundleFlag.GET_BUNDLE_INFO_DEFAULT;
      bundleManager.getBundleInfoForSelf(bundleFlags).then((appInfo) => {
        const sAppVersion = appInfo.versionName;
        const cpJSON = this.readFileToString(codepushjsonpath);
        const bundlePath = context.filesDir + '/CodePush/' + cpJSON['currentPackage'] + '/app.json';
        const bundleJSON = this.readFileToString(bundlePath);
        if(sAppVersion !== bundleJSON['appVersion']){
          console.log(`appVersion不一致：原${bundleJSON['appVersion']}-新${sAppVersion}`)
          fs.rmdirSync(context.filesDir)
        }
      });
    }
  }
  readFileToString(filePath:string):object{
    let readTextOptions: ReadTextOptions = {
      offset: 0,
      length: 0,
      encoding: 'utf-8'
    }
    let stat = fs.statSync(filePath);
    readTextOptions.length = stat.size;
    let str = fs.readTextSync(filePath,readTextOptions);
    return JSON.parse(str)
  }
}
