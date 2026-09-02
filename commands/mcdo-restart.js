const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcdo-restart')
        .setDescription('Restart the Mcdollibee bot service on Render'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const apiKey    = process.env.RENDER_API_KEY;
        const serviceId = process.env.MCDO_SERVICE_ID;

        if (!apiKey || !serviceId) {
            return interaction.editReply('Missing `RENDER_API_KEY` or `MCDO_SERVICE_ID` environment variable.');
        }

        try {
            await axios.post(
                `https://api.render.com/v1/services/${serviceId}/restart`,
                {},
                { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
            );
            await interaction.editReply('Mcdollibee is restarting...');
        } catch (err) {
            const status = err.response?.status;
            await interaction.editReply(`Failed to restart Mcdollibee (HTTP ${status ?? 'unknown'}).`);
        }
    },
};
