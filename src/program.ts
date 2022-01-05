import Progress from 'cli-progress';
import Discord from 'discord.js';
import Inquirer from 'inquirer';

import { Crypto } from './crypto';

export class Program {
    public static async Main() {
        const client = new Discord.Client({
            ws: {
                intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS'],
            },
        });

        client.on('warn', (message) => console.warn('Discord warning: %s', message));
        client.on('error', (err) => console.error('Discord error: ', err.stack));

        while (true) {
            const { token } = await Inquirer.prompt<{ token: string }>([
                {
                    // mask: '*',
                    message: 'Discord Token',
                    name: 'token',
                    type: 'input',
                    validate(input) {
                        return /[\d.a-z]+/i.test(input);
                    },
                },
            ]);

            try {
                console.log('Attempting login...');
                await client.login(token.trim());
                console.log('Connected!\nAwaiting identity confirmation...');
                await new Promise<void>((r) => client.once('ready', () => r()));
                console.log('Successfully logged in as %s', client.user?.tag);
                break;
            } catch (err) {
                console.error('Invalid token provided. Please try again.');
            }
        }

        let guild: Discord.Guild;
        while (true) {
            const { guildId } = await Inquirer.prompt<{ guildId: string }>([
                {
                    choices: client.guilds.cache.map(({ name, id }) => ({
                        name: `${name} (${id})`,
                        value: id,
                    })),
                    message: 'Discord Guild',
                    name: 'guildId',
                    type: 'list',
                },
            ]);

            try {
                console.log('Loading guild %s...', guildId);
                guild = await client.guilds.fetch(guildId);
                console.log('Successfully loaded guild %s (%s)', guild.name, guild.id);
                break;
            } catch (err) {
                console.error('Error loading guild %s: %s', guildId, (err as Error).stack);
            }
        }

        let channel: Discord.TextChannel;
        while (true) {
            const { channelId } = await Inquirer.prompt<{ channelId: string }>([
                {
                    choices: guild.channels.cache
                        .filter((channel) => channel.type === 'text')
                        .filter((channel) => channel.name.includes('│'))
                        .sort(
                            (a, b) => (a.parent?.position ?? 0) - (b.parent?.position ?? 0) || a.position - b.position
                        )
                        .map(({ name, id }) => ({
                            name: `${name} (${id})`,
                            value: id,
                        })),
                    message: 'Discord Channel',
                    name: 'channelId',
                    type: 'list',
                },
            ]);

            try {
                console.log('Finding channel %s', channelId);
                const provisional = guild.channels.cache.get(channelId);
                if (provisional) {
                    channel = provisional as Discord.TextChannel;
                    console.log('Found channel %s (%s) of type %s', provisional.name, provisional.id, provisional.type);
                    break;
                }

                console.log('Error finding channel %s: does not exist');
            } catch (err) {
                console.error('Error finding channel %s: %s', channelId, (err as Error).stack);
            }
        }

        let message: Discord.Message;
        while (true) {
            try {
                enum EMessageTarget {
                    LATEST,
                    PROVIDED_ID,
                }

                const { target } = await Inquirer.prompt<{ target: EMessageTarget }>([
                    {
                        choices: [
                            { name: 'Use Latest Message', value: EMessageTarget.LATEST },
                            { name: 'Provide Message ID', value: EMessageTarget.PROVIDED_ID },
                        ],
                        message: 'Discord Message Target',
                        name: 'target',
                        type: 'list',
                    },
                ]);

                let provisional: Discord.Message | undefined;
                switch (target) {
                    case EMessageTarget.LATEST: {
                        console.log('Fetching latest messages...');
                        const messages = await channel.messages.fetch({ limit: 1 });
                        console.log('Received %s messages', messages.size);
                        if (messages.size === 0) {
                            throw new Error(
                                'Error finding target message: no read history permissions or channel empty.'
                            );
                        }
                        provisional = messages.last();
                        break;
                    }

                    case EMessageTarget.PROVIDED_ID: {
                        const { messageId } = await Inquirer.prompt<{ messageId: string }>([
                            {
                                message: 'Discord Message ID',
                                name: 'messageId',
                                type: 'input',
                            },
                        ]);

                        let cursor: string | undefined;
                        const SIZE = 100;
                        while (true) {
                            if (cursor) {
                                console.log('Paginating messages target=%s', cursor);
                            }
                            const messages = await channel.messages.fetch({ before: cursor, limit: SIZE });
                            console.log('Received %d messages', messages.size);
                            if (messages.size === 0) {
                                console.log('Reached end of messages');
                                break;
                            }

                            const theMessage = messages.find((m) => m.id === messageId.toString().trim());
                            if (theMessage) {
                                provisional = theMessage;
                                break;
                            }

                            if (messages.size < SIZE) {
                                console.log('Reached end of messages');
                                break;
                            } else {
                                const newCursor = messages.last()!.id;
                                if (cursor === newCursor) {
                                    console.warn('Looping cursor detected, breaking');
                                    break;
                                }
                                cursor = newCursor;
                            }
                        }
                        break;
                    }
                }

                if (!provisional) {
                    throw new Error('Error finding message. Please try again.');
                }

                message = provisional;
                console.log('Successfully found target message %s:\n%s', message.id, message.content);
                break;
            } catch (err) {
                console.log('Error ocurred finding target message: %s', (err as Error).stack);
            }
        }

        let reaction: Discord.MessageReaction;
        while (true) {
            const { reactionId } = await Inquirer.prompt<{ reactionId: string }>([
                {
                    choices: message.reactions.cache.map((r) => ({
                        name: r.emoji.name,
                        value: r.emoji.identifier,
                    })),
                    message: 'Discord Reaction Target',
                    name: 'reactionId',
                    type: 'list',
                },
            ]);
            const provisional = message.reactions.cache.find((r) => r.emoji.identifier === reactionId);
            if (provisional) {
                reaction = provisional;
                break;
            }

            console.warn('Error finding reaction %s', reactionId);
        }

        const reactorProgress = new Progress.SingleBar({}, Progress.Presets.rect);
        console.log('Loading reactors for reaction %s', reaction.emoji.identifier);
        reactorProgress.start(reaction.count || 0, 0);

        const userSet = new Set<Discord.User>();
        const SIZE = 100;
        let cursor: string | undefined;
        while (true) {
            const reactors = await reaction.users.fetch({
                after: cursor,
                limit: SIZE,
            });
            reactorProgress.increment(reactors.size);

            for (const user of reactors.values()) {
                userSet.add(user);
            }

            if (reactors.size < SIZE) {
                break;
            }

            cursor = reactors.last()!.id;
        }
        reactorProgress.stop();
        console.log('Cached %d members from reactions', userSet.size);

        const userList = [...userSet];

        const memberProgress = new Progress.SingleBar({}, Progress.Presets.rect);
        console.log('Loading guild members role cache...');
        memberProgress.start(guild.memberCount, 0);
        client.on('guildMembersChunk', ({ size }) => memberProgress.increment(size));
        const guildMembers = await guild.members.fetch();
        memberProgress.stop();
        console.log('Successfully loaded %d members', guildMembers.size);

        while (true) {
            const { shouldContinue } = await Inquirer.prompt<{ shouldContinue: boolean }>({
                message: 'Draft Winner?',
                name: 'shouldContinue',
                type: 'confirm',
            });

            if (!shouldContinue) {
                console.log('Great stream pokiL');
                break;
            }

            let hasRoles = false;
            let offset = 0;
            let winner: Discord.GuildMember;

            while (!hasRoles) {
                offset = await Crypto.randomNumberSafe(0, userList.length - 1);

                const user = userList[offset];
                const member = guildMembers.find((member) => member.user?.id === user?.id);
                if (!member) {
                    console.warn('Error finding member %s (%s)', user.tag, user.id);
                    continue;
                }

                winner = member;
                hasRoles = member.roles.cache.size > 0;
            }

            console.log(
                [
                    '',
                    'New Winner pokiWow',
                    `Tag: ${winner!.user.tag}`,
                    `ID: ${winner!.id}`,
                    `Roles: ${winner!.roles.cache
                        .map((r) => r.name)
                        .filter((n) => !n.startsWith('━'))
                        .join(', ')}`,
                    `Position: ${offset}`,
                    '',
                ].join('\n')
            );
        }

        client.destroy();
        await new Promise((r) => setTimeout(r, 1000));
    }
}
