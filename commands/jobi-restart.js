const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jobi-restart')
        .setDescription('Restart the Jobbilee bot service on Render'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const apiKey    = process.env.RENDER_API_KEY;
        const serviceId = process.env.JOBI_SERVICE_ID;

        if (!apiKey || !serviceId) {
            return interaction.editReply('Missing `RENDER_API_KEY` or `JOBI_SERVICE_ID` environment variable.');
        }

        try {
            await axios.post(
                `https://api.render.com/v1/services/${serviceId}/restart`,
                {},
                { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
            );
            await interaction.editReply('Jobbilee is restarting...');
        } catch (err) {
            const status  = err.response?.status;
            const message = err.response?.data?.message ?? err.message;
            await interaction.editReply(`Failed to restart Jobbilee (HTTP ${status ?? 'unknown'}): ${message}`);
        }
    },
};
