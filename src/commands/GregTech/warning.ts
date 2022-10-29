import {ApplyOptions} from '@sapphire/decorators';
import {Subcommand} from '@sapphire/plugin-subcommands';
import {getConnection, getLoadingMessage} from "../../lib/utils";
import {MessageEmbed, TextChannel} from "discord.js";

@ApplyOptions<Subcommand.Options>({
    description: 'Warnings.',
    subcommands: [
        {
            name: 'add',
            chatInputRun: 'addWarning'
        },
        {
            name: 'resolve',
            chatInputRun: 'resolveWarning'
        }
    ]
})
export class UserCommand extends Subcommand {
    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) => {
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Make a warning.')
                        .addStringOption((option) =>
                            option.setName('title').setDescription('The warning\'s title.').setRequired(true)
                        )
                        .addStringOption((option) =>
                            option.setName('description').setDescription('The warning\'s description.').setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('resolve')
                        .setDescription('Resolve a warning.')
                        .addStringOption((option) =>
                            option.setName('id').setDescription('The warning\'s ID.').setRequired(true)
                        )
                        .addStringOption((option) =>
                            option.setName('description').setDescription('How it got resolved').setRequired(false)
                        )
                        .addUserOption((option) =>
                            option.setName('responsible').setDescription('Who resolved it.').setRequired(false)
                        )
                );
        });
    }

    public async addWarning(interaction: Subcommand.ChatInputInteraction) {
        const title = interaction.options.getString('title', true);
        const description = interaction.options.getString('description', true);

        if (!interaction.guild) return interaction.reply({content: 'This command can only be used in a server.', ephemeral: true});

        const warnChannel = await interaction.guild.channels.fetch(`${process.env.WARNING_CHANNEL ?? ''}`) as TextChannel;
        if (!warnChannel) return interaction.reply({content: 'The warning channel is not set up.', ephemeral: true});

        const loadEmbed = new MessageEmbed()
            .setDescription(`<a:loading:695008953934938143> ${getLoadingMessage()}`)
            .setColor('YELLOW');

        await interaction.reply({embeds: [loadEmbed], fetchReply: true, ephemeral: true});

        const connection = await getConnection();

        const warnEmbed = new MessageEmbed()
            .setTitle(title)
            .setDescription(description ?? 'No description provided.')
            .setColor('RED')
            .setTimestamp();

        const warns = await connection.query(`SELECT * FROM warnings`);
        warnEmbed.footer = {
            text: `ID: ${warns.length + 1}`
        }

        const message = await warnChannel.send({embeds: [warnEmbed]});

        const response = await connection.query('INSERT INTO `warnings` (`message`, `name`, `description`) VALUES (?, ?, ?)', [
            message.id,
            description,
            interaction.user.id
        ]);
        await connection.end();

        const embed = new MessageEmbed()
            .setTitle('Warning added')
            .setDescription(`Your warning has been added with ID \`${response.insertId}\`.`)
            .setColor('GREEN');

        await interaction.editReply({embeds: [embed]});
    }

    public async resolveWarning(interaction: Subcommand.ChatInputInteraction) {
        const id = interaction.options.getString('id', true);
        const description = interaction.options.getString('description', false);
        const responsible = interaction.options.getUser('responsible', false) ?? interaction.user;

        if (!interaction.guild) return interaction.reply({content: 'This command can only be used in a server.', ephemeral: true});

        const warnChannel = await interaction.guild.channels.fetch(`${process.env.WARNING_CHANNEL ?? ''}`) as TextChannel;
        if (!warnChannel) return interaction.reply({content: 'The warning channel is not set up.', ephemeral: true});

        const loadEmbed = new MessageEmbed()
            .setDescription(`<a:loading:695008953934938143> ${getLoadingMessage()}`)
            .setColor('YELLOW');

        await interaction.reply({embeds: [loadEmbed], fetchReply: true, ephemeral: true});

        const connection = await getConnection();

        const warn = await connection.query(`SELECT * FROM warnings WHERE id = ?`, [id]);

        const noWarnEmbed = new MessageEmbed()
            .setTitle('No warning found')
            .setDescription(`There is no warning with ID \`${id}\`.`)
            .setColor('RED');

        if (warn.length === 0) return interaction.editReply({embeds: [noWarnEmbed]});

        const channel = await interaction.guild.channels.fetch(`${process.env.WARNING_CHANNEL}`) as TextChannel;

        const warnEmbed = new MessageEmbed()
            .setTitle(`${warn[0].name} (Resolved)`)
            .setDescription(`${warn[0].description ?? 'No description provided.'}`)
            .setColor('GREEN')
            .setTimestamp();

        warnEmbed.author = {
            name: "Resolved by " + responsible.tag,
            iconURL: responsible.displayAvatarURL()
        }

        if (description) warnEmbed.fields.push({
            name: 'Aftermath',
            value: description,
            inline: false
        });
        warnEmbed.fields.push({
            name: 'Responsible',
            value: `<@${responsible.id}>`,
            inline: false
        });

        await channel.send({embeds: [warnEmbed]});

        await connection.query('UPDATE `warnings` SET `resolved` = ?, `resolver` = ? WHERE `id` = ?', [true, responsible.id, id]);
        if (description) await connection.query('UPDATE `warnings` SET `resolver_description` = ? WHERE `id` = ?', [description, id]);
        await connection.end();

        const embed = new MessageEmbed()
            .setTitle('Warning resolved')
            .setDescription(`The warning has been resolved.`)
            .setColor('GREEN');

        await interaction.editReply({embeds: [embed]});
    }
}
