/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import { RNPackage, UITurboModule,UITurboModuleContext,UITurboModuleFactory } from "@rnoh/react-native-openharmony/ts";
import { TM } from "@rnoh/react-native-openharmony/generated/ts";
import { CodePushNativeModule } from './CodePushNativeModule';
import { CodePushBuilder } from './CodePushBuilder';
import fs, { ReadTextOptions } from "@ohos.file.fs";
import common from '@ohos.app.ability.common';
import { bundleManager } from '@kit.AbilityKit';
import Logger from './Logger';

const TAG = 'CodePushNativeModule-CodePushPackage: '

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
    return new CodePushModulesFactory(ctx);
  }
}

export function comparingVersion(context) {
  const codepushjsonpath = context.filesDir + '/CodePush/codepush.json';
  if (fs.accessSync(codepushjsonpath)) {
    let bundleFlags = bundleManager.BundleFlag.GET_BUNDLE_INFO_DEFAULT;
    bundleManager.getBundleInfoForSelf(bundleFlags).then((appInfo) => {
      const sAppVersion = appInfo.versionName;
      const cpJSON = readFileToString(codepushjsonpath);
      const bundlePath = context.filesDir + '/CodePush/' + cpJSON['currentPackage'] + '/app.json';
      const bundleJSON = readFileToString(bundlePath);
      if (sAppVersion !== bundleJSON['appVersion']) {
        Logger.info(TAG, `appVersion不一致：原${bundleJSON['appVersion']}-新${sAppVersion}`)
        fs.rmdirSync(context.filesDir + '/Bundles')
        fs.rmdirSync(context.filesDir + '/CodePush')
      }
    });
  }
}

function readFileToString(filePath: string): object {
  let readTextOptions: ReadTextOptions = {
    offset: 0,
    length: 0,
    encoding: 'utf-8'
  }
  let stat = fs.statSync(filePath);
  readTextOptions.length = stat.size;
  let str = fs.readTextSync(filePath, readTextOptions);
  return JSON.parse(str);
}