'use client';

import { useAutoAnimate } from '@formkit/auto-animate/react';
import { ModelTag } from '@lobehub/icons';
import { ActionIconGroup, Block, Grid, Markdown, Tag, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { omit } from 'lodash-es';
import { CopyIcon, RotateCcwSquareIcon, Trash2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import InvalidAPIKey from '@/features/Conversation/Error/InvalidAPIKey';
import { useImageStore } from '@/store/image';
import { StdImageGenParams } from '@/store/image/utils/StandardParameters';
import { AsyncTaskErrorType } from '@/types/asyncTask';
import { GenerationBatch } from '@/types/generation';

import { GenerationItem } from './GenerationItem';

const useStyles = createStyles(({ cx, css, token }) => ({
  prompt: css`
    pre {
      overflow: hidden !important;
      padding-block: 4px;
      font-size: 13px;
    }
  `,
  container: css`
    &:hover {
      .batch-actions {
        opacity: 1;
      }
    }
  `,
  batchActions: cx(
    'batch-actions',
    css`
      opacity: 0;
      transition: opacity 0.1s ${token.motionEaseInOut};
    `,
  ),

  batchDeleteButton: css`
    &:hover {
      border-color: ${token.colorError} !important;
      color: ${token.colorError} !important;
      background: ${token.colorErrorBg} !important;
    }
  `,
}));

// 扩展 dayjs 插件
dayjs.extend(relativeTime);

interface GenerationBatchItemProps {
  batch: GenerationBatch;
}

export const GenerationBatchItem = memo<GenerationBatchItemProps>(({ batch }) => {
  const { styles } = useStyles();
  const { t } = useTranslation(['image', 'modelProvider', 'error']);
  const { message } = App.useApp();

  const [imageGridRef] = useAutoAnimate();

  const activeTopicId = useImageStore((s) => s.activeGenerationTopicId);
  const removeGenerationBatch = useImageStore((s) => s.removeGenerationBatch);
  const recreateImage = useImageStore((s) => s.recreateImage);
  const reuseSettings = useImageStore((s) => s.reuseSettings);

  const time = useMemo(() => {
    return dayjs(batch.createdAt).format('YYYY-MM-DD HH:mm:ss');
  }, [batch.createdAt]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(batch.prompt);
      message.success(t('generation.actions.promptCopied'));
    } catch (error) {
      console.error('Failed to copy prompt:', error);
      message.error(t('generation.actions.promptCopyFailed'));
    }
  };

  const handleReuseSettings = () => {
    reuseSettings(batch.model, batch.provider, omit(batch.config as StdImageGenParams, ['seed']));
  };

  const handleDeleteBatch = async () => {
    if (!activeTopicId) return;

    try {
      await removeGenerationBatch(batch.id, activeTopicId);
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  };

  if (batch.generations.length === 0) {
    return null;
  }

  const isInvalidApiKey = batch.generations.some(
    (generation) => generation.task.error?.name === AsyncTaskErrorType.InvalidProviderAPIKey,
  );

  if (isInvalidApiKey) {
    return (
      <InvalidAPIKey
        bedrockDescription={t('bedrock.unlock.imageGenerationDescription', { ns: 'modelProvider' })}
        description={t('unlock.apiKey.imageGenerationDescription', {
          name: batch.provider,
          ns: 'error',
        })}
        id={batch.id}
        onClose={() => {
          removeGenerationBatch(batch.id, activeTopicId!);
        }}
        onRecreate={() => {
          recreateImage(batch.id);
        }}
        provider={batch.provider}
      />
    );
  }

  return (
    <Block className={styles.container} gap={8} variant="borderless">
      <Markdown variant={'chat'}>{batch.prompt}</Markdown>
      <Flexbox gap={4} horizontal justify="space-between" style={{ marginBottom: 10 }}>
        <Flexbox gap={4} horizontal>
          <ModelTag model={batch.model} />
          {batch.width && batch.height && (
            <Tag>
              {batch.width} × {batch.height}
            </Tag>
          )}
          <Tag>{t('generation.metadata.count', { count: batch.generations.length })}</Tag>
        </Flexbox>
      </Flexbox>
      <Grid maxItemWidth={200} ref={imageGridRef} rows={batch.generations.length || 4}>
        {batch.generations.map((generation) => (
          <GenerationItem generation={generation} key={generation.id} prompt={batch.prompt} />
        ))}
      </Grid>
      <Flexbox
        align={'center'}
        className={styles.batchActions}
        horizontal
        justify={'space-between'}
      >
        <Text as={'time'} fontSize={12} type={'secondary'}>
          {time}
        </Text>
        <ActionIconGroup
          items={[
            {
              icon: RotateCcwSquareIcon,
              onClick: handleReuseSettings,
              label: t('generation.actions.reuseSettings'),
              key: 'reuseSettings',
            },
            {
              icon: CopyIcon,
              onClick: handleCopyPrompt,
              label: t('generation.actions.copyPrompt'),
              key: 'copyPrompt',
            },
            {
              icon: Trash2,
              onClick: handleDeleteBatch,
              label: t('generation.actions.deleteBatch'),
              key: 'deleteBatch',
              danger: true,
            },
          ]}
        />
      </Flexbox>
    </Block>
  );
});

GenerationBatchItem.displayName = 'GenerationBatchItem';
