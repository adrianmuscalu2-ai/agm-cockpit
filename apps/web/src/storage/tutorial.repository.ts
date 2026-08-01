import { storageKeys } from './storage-registry';

type TutorialStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createTutorialRepository(storage: TutorialStorage) {
  return {
    isTutorialCompleted() {
      return Boolean(storage.getItem(storageKeys.tutorialCompletion));
    },

    isEmailTutorialCompleted() {
      return Boolean(storage.getItem(storageKeys.emailTutorialCompletion));
    },

    isRoadmapInvitationDismissed() {
      return Boolean(storage.getItem(storageKeys.roadmapInvitation));
    },

    markTutorialCompleted(completedAt: string) {
      storage.setItem(storageKeys.tutorialCompletion, completedAt);
      return completedAt;
    },

    markEmailTutorialCompleted(completedAt: string) {
      storage.setItem(storageKeys.emailTutorialCompletion, completedAt);
      return completedAt;
    },

    dismissRoadmapInvitation(dismissedAt: string) {
      storage.setItem(storageKeys.roadmapInvitation, dismissedAt);
      return dismissedAt;
    },

    clearForOcrHistoryDeletion() {
      storage.removeItem(storageKeys.tutorialCompletion);
      storage.removeItem(storageKeys.emailTutorialCompletion);
      storage.removeItem(storageKeys.roadmapInvitation);
    },
  };
}
