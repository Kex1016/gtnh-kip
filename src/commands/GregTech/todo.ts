import {ApplyOptions} from '@sapphire/decorators';
import {Subcommand} from '@sapphire/plugin-subcommands';
import {getConnection, getLoadingMessage} from "../../lib/utils";
import {MessageEmbed, TextChannel} from "discord.js";
import {PaginatedMessage} from "@sapphire/discord.js-utilities";

const urgency = [
    {
        name: 'Low',
        value: 'LOW'
    },
    {
        name: 'Medium',
        value: 'MEDIUM'
    },
    {
        name: 'High',
        value: 'HIGH'
    }
];

const status = [
    {
        name: 'Open',
        value: 'OPEN'
    },
    {
        name: 'In Progress',
        value: 'IN_PROGRESS'
    },
    {
        name: 'Done',
        value: 'DONE'
    }
];

@ApplyOptions<Subcommand.Options>({
    description: 'TODO list functions',
    subcommands: [
        {
            name: 'list',
            chatInputRun: 'listTodo'
        },
        {
            name: 'add',
            chatInputRun: 'addTodo'
        },
        {
            name: 'edit',
            chatInputRun: 'setTodo'
        },
        {
            name: 'remove',
            chatInputRun: 'removeTodo'
        },
        {
            name: 'claim',
            chatInputRun: 'claimTodo'
        },
        {
            name: 'unclaim',
            chatInputRun: 'unclaimTodo'
        }
    ]
})
export class UserCommand extends Subcommand {
    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) => {
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addSubcommand((subcommand) => {
                    return subcommand
                        .setName('add')
                        .setDescription('Add a task to the TODO list')
                        .addStringOption((option) => option.setName('name').setDescription('Short name of TODO').setRequired(true))
                        .addStringOption((option) => option.setName('description').setDescription('What are we planning?').setRequired(true))
                        .addStringOption((option) => {
                            let _option = option.setName('urgency').setDescription('How urgent is this task?').setRequired(false);
                            for (const choice of urgency) {
                                _option = _option.addChoices(choice);
                            }
                            return _option;
                        });
                })
                .addSubcommand((subcommand) => {
                    return subcommand
                        .setName('list')
                        .setDescription('List all tasks in the TODO list')
                        .addBooleanOption((option) => option.setName('send').setDescription('Send the list to the channel?').setRequired(false));
                })
                .addSubcommand((subcommand) => {
                    return subcommand
                        .setName('edit')
                        .setDescription('Edit a task in the TODO list')
                        .addIntegerOption((option) => option.setName('id').setDescription('ID of TODO').setRequired(true))
                        .addStringOption((option) => {
                            let _option = option.setName('status').setDescription('How is the task going along?').setRequired(false);
                            for (const choice of status) {
                                _option = option.addChoices(choice);
                            }
                            return _option;
                        })
                        .addStringOption((option) => {
                            let _option = option.setName('urgency').setDescription('How urgent is the task?').setRequired(false)
                            for (const item of urgency) {
                                _option = option.addChoices(item)
                            }
                            return _option;
                        });
                })
                .addSubcommand((subcommand) => {
                    return subcommand
                        .setName('remove')
                        .setDescription('Remove a task from the TODO list')
                        .addIntegerOption((option) => option.setName('id').setDescription('ID of TODO').setRequired(true));
                })
                .addSubcommand((subcommand) => {
                    return subcommand
                        .setName('claim')
                        .setDescription('Claim a task from the TODO list')
                        .addIntegerOption((option) => option.setName('id').setDescription('ID of TODO').setRequired(true));
                })
                .addSubcommand((subcommand) => {
                    return subcommand
                        .setName('unclaim')
                        .setDescription('Unclaim a task from the TODO list')
                        .addIntegerOption((option) => option.setName('id').setDescription('ID of TODO').setRequired(true));
                });
        });
    }

    public async listTodo(interaction: Subcommand.ChatInputInteraction) {
        const loadEmbed = new MessageEmbed()
            .setDescription(`<a:loading:695008953934938143> ${getLoadingMessage()}`)
            .setColor('YELLOW');

        const send = !interaction.options.getBoolean('send', false) ?? true;

        const response = await interaction.reply({embeds: [loadEmbed], fetchReply: true, ephemeral: send});

        const connection = await getConnection();
        const rows = await connection.query('SELECT * FROM todo');
        await connection.end();

        const templateEmbed = new MessageEmbed()
            .setTitle('TODO List')
            .setColor('#0099ff')
            .setFooter({
                text: ` requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({dynamic: true})
            });

        const paginatedMessage = new PaginatedMessage({
            template: templateEmbed,
            embedFooterSeparator: " | "
        });

        for (const row of rows) {
            let embed = new MessageEmbed()
                .setTitle(`#${row.id} - ${row.name}`)
                .setDescription(row.description);

            let claimed;
            if (row.claimed_by) claimed = `<@${row.claimed_by}>`;
            else claimed = 'Nobody';

            embed.fields = [
                {
                    name: 'Urgency',
                    value: `${row.urgency}`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: `${row.status}`,
                    inline: true
                },
                {
                    name: 'Claimed By',
                    value: claimed,
                    inline: true
                }
            ]
            paginatedMessage.addPageEmbed(embed);
        }

        await paginatedMessage.run(interaction, interaction.user);
        return response;
    }

    public async addTodo(interaction: Subcommand.ChatInputInteraction) {
        const name = interaction.options.getString('name', true);
        const description = interaction.options.getString('description', true);
        const urgency = interaction.options.getString('urgency', false);

        const connection = await getConnection();
        const query = 'INSERT INTO todo (name, description, urgency) VALUES (?, ?, ?)';
        await connection.execute(query, [name, description, urgency]);
        await connection.end();

        await interaction.reply(`Added task ${name} to the TODO list`);

        const channel = await this.container.client.channels.fetch(`${process.env.TODO_CHANNEL}`) as TextChannel;
        const embed = new MessageEmbed()
            .setTitle(`New TODO: ${name}`)
            .setDescription(description)
            .setColor('GREEN')
            .setFooter({
                text: `requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({dynamic: true})
            });
        return await channel.send({embeds: [embed]});
    }

    public async setTodo(interaction: Subcommand.ChatInputInteraction) {
        const loadEmbed = new MessageEmbed()
            .setDescription(`<a:loading:695008953934938143> ${getLoadingMessage()}`)
            .setColor('YELLOW');

        await interaction.reply({embeds: [loadEmbed], fetchReply: true, ephemeral: true});

        const id = interaction.options.getInteger('id', true);
        const status = interaction.options.getString('status', false);
        const urgency = interaction.options.getString('urgency', false);

        const connection = await getConnection();
        let query = 'UPDATE todo SET status = ?, urgency = ? WHERE id = ?';

        if (status && urgency) {
            await connection.execute(query, [status, urgency, id]);
        } else if (status) {
            query = 'UPDATE todo SET status = ? WHERE id = ?';
            await connection.execute(query, [status, id]);
        } else if (urgency) {
            query = 'UPDATE todo SET urgency = ? WHERE id = ?';
            await connection.execute(query, [urgency, id]);
        }

        const editedTODO = await connection.query('SELECT * FROM todo WHERE id = ?', [id]);
        const claimed = editedTODO[0].claimed_by ? `<@${editedTODO[0].claimed_by}>` : 'Nobody';
        const embed = new MessageEmbed()
            .setTitle(`#${editedTODO[0].id} - ${editedTODO[0].name}`)
            .setDescription(editedTODO[0].description);
        embed.fields = [
            {
                name: 'Urgency',
                value: `${editedTODO[0].urgency}`,
                inline: true
            },
            {
                name: 'Status',
                value: `${editedTODO[0].status}`,
                inline: true
            },
            {
                name: 'Claimed By',
                value: `${claimed}`,
                inline: true
            },
        ]

        await connection.end();

        await interaction.editReply({
            content: `Updated task ${id} in the TODO list. Here's the new info:`,
            embeds: [embed]
        });

        const channel = await this.container.client.channels.fetch(`${process.env.TODO_CHANNEL}`) as TextChannel;
        const todoEmbed = new MessageEmbed()
            .setTitle(`TODO Updated: ${editedTODO[0].name}`)
            .setDescription(editedTODO[0].description)
            .setColor('YELLOW')
            .setFooter({
                text: `requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({dynamic: true})
            });
        todoEmbed.fields = [
            {
                name: 'Urgency',
                value: `${editedTODO[0].urgency}`,
                inline: true
            },
            {
                name: 'Status',
                value: `${editedTODO[0].status}`,
                inline: true
            }
        ]
        return await channel.send({embeds: [todoEmbed]});
    }

    public async removeTodo(interaction: Subcommand.ChatInputInteraction) {
        const id = interaction.options.getInteger('id', true);

        const connection = await getConnection();
        const query = 'DELETE FROM todo WHERE id = ?';
        await connection.execute(query, [id]);
        await connection.end();

        await interaction.reply(`Removed task ${id} from the TODO list`);

        const channel = await this.container.client.channels.fetch(`${process.env.TODO_CHANNEL}`) as TextChannel;
        const embed = new MessageEmbed()
            .setTitle(`TODO Removed: ${id}`)
            .setColor('RED')
            .setFooter({
                text: `requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({dynamic: true})
            });
        return await channel.send({embeds: [embed]});
    }

    public async claimTodo(interaction: Subcommand.ChatInputInteraction) {
        const loadEmbed = new MessageEmbed()
            .setDescription(`<a:loading:695008953934938143> ${getLoadingMessage()}`)
            .setColor('YELLOW');

        await interaction.reply({embeds: [loadEmbed], fetchReply: true, ephemeral: true});

        const id = interaction.options.getInteger('id', true);

        const connection = await getConnection();
        const query = 'UPDATE todo SET status = ?, claimed_by = ? WHERE id = ?';
        await connection.execute(query, ['IN_PROGRESS', interaction.user.id, id]);

        const claimedTODO = await connection.query('SELECT * FROM todo WHERE id = ?', [id]);
        const embed = new MessageEmbed()
            .setTitle(`#${claimedTODO[0].id} - ${claimedTODO[0].name}`)
            .setDescription(claimedTODO[0].description);
        embed.fields = [
            {
                name: 'Urgency',
                value: `${claimedTODO[0].urgency}`,
                inline: true
            },
            {
                name: 'Status',
                value: `${claimedTODO[0].status}`,
                inline: true
            },
            {
                name: 'Claimed By',
                value: `<@${claimedTODO[0].claimed_by}>`,
                inline: true
            }
        ]

        await connection.end();

        await interaction.editReply({
            content: `Claimed task ${id} in the TODO list. Here's the new info:`,
            embeds: [embed]
        });

        const channel = await this.container.client.channels.fetch(`${process.env.TODO_CHANNEL}`) as TextChannel;
        const todoEmbed = new MessageEmbed()
            .setTitle(`TODO Claimed: ${claimedTODO[0].name}`)
            .setDescription(claimedTODO[0].description)
            .setColor('ORANGE')
            .setFooter({
                text: `requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({dynamic: true})
            });
        todoEmbed.fields = [
            {
                name: 'Urgency',
                value: `${claimedTODO[0].urgency}`,
                inline: true
            },
            {
                name: 'Status',
                value: `${claimedTODO[0].status}`,
                inline: true
            },
            {
                name: 'Claimed By',
                value: `<@${claimedTODO[0].claimed_by}>`,
                inline: true
            }
        ]
        return await channel.send({embeds: [todoEmbed]});
    }

    public async unclaimTodo(interaction: Subcommand.ChatInputInteraction) {
        const loadEmbed = new MessageEmbed()
            .setDescription(`<a:loading:695008953934938143> ${getLoadingMessage()}`)
            .setColor('YELLOW');

        await interaction.reply({embeds: [loadEmbed], fetchReply: true, ephemeral: true});

        const id = interaction.options.getInteger('id', true);

        const connection = await getConnection();
        const query = 'UPDATE todo SET status = ?, claimed_by = ? WHERE id = ?';
        await connection.execute(query, ['OPEN', null, id]);

        const unclaimedTODO = await connection.query('SELECT * FROM todo WHERE id = ?', [id]);
        const embed = new MessageEmbed()
            .setTitle(`#${unclaimedTODO[0].id} - ${unclaimedTODO[0].name}`)
            .setDescription(unclaimedTODO[0].description);
        embed.fields = [
            {
                name: 'Urgency',
                value: `${unclaimedTODO[0].urgency}`,
                inline: true
            },
            {
                name: 'Status',
                value: `${unclaimedTODO[0].status}`,
                inline: true
            },
            {
                name: 'Claimed By',
                value: 'Nobody',
                inline: true
            }
        ];

        await connection.end();

        await interaction.editReply({
            content: `Unclaimed task ${id} in the TODO list. Here's the new info:`,
            embeds: [embed]
        });

        const channel = await this.container.client.channels.fetch(`${process.env.TODO_CHANNEL}`) as TextChannel;
        const todoEmbed = new MessageEmbed()
            .setTitle(`TODO Unclaimed: ${unclaimedTODO[0].name}`)
            .setDescription(unclaimedTODO[0].description)
            .setColor('ORANGE')
            .setFooter({
                text: `requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({dynamic: true})
            });
        todoEmbed.fields = [
            {
                name: 'Urgency',
                value: `${unclaimedTODO[0].urgency}`,
                inline: true
            },
            {
                name: 'Status',
                value: `${unclaimedTODO[0].status}`,
                inline: true
            },
            {
                name: 'Claimed By',
                value: 'Nobody',
                inline: true
            }
        ]
        return await channel.send({embeds: [todoEmbed]});
    }
}
