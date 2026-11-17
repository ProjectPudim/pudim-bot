import { Category } from '#bot/config'
import { createCommand } from '#bot/fluxer'
import { buildUserInfoEmbeds } from '#bot/modules/userinfo'
import { fetchFluxerProfile } from '#bot/services'
import {
  fetchMember,
  parseUserId,
  resolveUser,
  safeReplyMentions,
  withTimeout,
} from '#bot/utils'

const API_TIMEOUT_MS = 4_000
const CLIENT_TIMEOUT_MS = 3_000
const MEMBER_TIMEOUT_MS = 3_000

export default createCommand({
  name: 'userinfo',
  description: 'Shows information about a user.',
  descriptionLocalizations: {
    'pt-BR': 'Mostra informações sobre um usuário.',
    'es-ES': 'Muestra información sobre un usuario.',
  },
  category: Category.Utilities,
  usage: '{prefix}userinfo [@user|id]',
  aliases: ['ui', 'uinfo', 'whois'],
  cooldown: { duration: 3_000, scope: 'user' },
  async run(ctx) {
    const { t, args, author, client, guildId } = ctx
    const raw = args[0]?.trim()
    const targetId = raw ? parseUserId(raw) : author.id

    if (!targetId) {
      await ctx.reply({
        content: t('common.invalid.messages.user'),
      })
      return
    }

    const memberPromise = guildId
      ? withTimeout(fetchMember(client, guildId, targetId), MEMBER_TIMEOUT_MS)
      : Promise.resolve(null)

    const apiUser = await withTimeout(
      fetchFluxerProfile(targetId),
      API_TIMEOUT_MS,
    )
    const user = apiUser
      ? null
      : await withTimeout(
          resolveUser(client, targetId, author),
          CLIENT_TIMEOUT_MS,
        )
    const member = await memberPromise

    if (!apiUser && !user) {
      await ctx.reply({
        content: t('common.notFound.messages.user', raw ?? targetId),
      })
      return
    }

    const embeds = buildUserInfoEmbeds({
      targetId,
      user,
      apiUser,
      member,
      t,
    })

    await ctx.reply({
      embeds,
      allowedMentions: safeReplyMentions(author.id),
    })
  },
})
