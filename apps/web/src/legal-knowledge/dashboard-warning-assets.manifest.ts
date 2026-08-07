export const dashboardWarningAssetManifest = {
  'WL-000': { assetPath: '/assets/dashboard-warnings/wl-000-scope.svg', sha256: '6570A0B963F1173865A0AE0BBB3D95189BE81796032A3E2E01CF4DC7F7326B56' },
  'WL-001': { assetPath: '/assets/dashboard-warnings/wl-001-stop.svg', sha256: '49EA5BA4938EAB30B128DA81180EC211073F894A5120E72CD0557BD77BD22CF5' },
  'WL-002': { assetPath: '/assets/dashboard-warnings/wl-002-brake.svg', sha256: 'F9E0C5191583CA165806B5A904F4AC9EC687B6D763FC1CE1DEC19EA6D55AC87A' },
  'WL-003': { assetPath: '/assets/dashboard-warnings/wl-003-abs.svg', sha256: 'AD6250A227AE722AC9A07BF4C0E76747893562247793D0DCE48CCA6B6164DA7D' },
  'WL-004': { assetPath: '/assets/dashboard-warnings/wl-004-oil.svg', sha256: '1F0CA24B1446CF5BDB0D055FBF6E10A7A27D905DD00F5084F7D550CACDB75A50' },
  'WL-005': { assetPath: '/assets/dashboard-warnings/wl-005-coolant.svg', sha256: '350E487338CB030F8CBFCF1D4F9CDD39334D6899FD293152EB12F82C1F930652' },
  'WL-006': { assetPath: '/assets/dashboard-warnings/wl-006-charge.svg', sha256: '40E9B4B771331813DD9E4CAA97C3239C697FE5B0F4B7DD01325C851685947D54' },
  'WL-007': { assetPath: '/assets/dashboard-warnings/wl-007-engine.svg', sha256: '43464DA6840DB8283B43B45D6479D7503B007D2B39CBE95EC3A6132558A9DD2C' },
  'WL-008': { assetPath: '/assets/dashboard-warnings/wl-008-fuel.svg', sha256: '45FB2E0AD378F0A13545932FD97B29C68C7466FA40D28079DFAA8B0120C711A9' },
  'WL-009': { assetPath: '/assets/dashboard-warnings/wl-009-adblue.svg', sha256: 'B3D03B05F29BF55D567B2682220F0A30735F0945CC6F76D4885C0B03CFF66258' },
  'WL-010': { assetPath: '/assets/dashboard-warnings/wl-010-dpf.svg', sha256: 'AA46984C50EBCE41CEA2B4FA72A7B06F3C8F593431343B4BEC2BD9C4C5F1B127' },
} as const;

export type DashboardWarningAssetId = keyof typeof dashboardWarningAssetManifest;
