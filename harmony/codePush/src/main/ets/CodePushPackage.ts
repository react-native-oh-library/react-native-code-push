import { RNPackage, TurboModulesFactory, } from "@rnoh/react-native-openharmony/ts";
import type { TurboModule, TurboModuleContext, } from "@rnoh/react-native-openharmony/ts";
import { TM } from "@rnoh/react-native-openharmony/generated/ts";
import { CodePushNativeModule } from './CodePushNativeModule';
import { CodePushBuilder } from './CodePushBuilder';

class CodePushModulesFactory extends TurboModulesFactory {
  createTurboModule(name: string): TurboModule | null {
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
  createTurboModulesFactory(ctx: TurboModuleContext): TurboModulesFactory {
    return new CodePushModulesFactory(ctx);
  }
}
